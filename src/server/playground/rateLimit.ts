import type { PrismaClient } from '@prisma/client';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_RUNS_PER_WINDOW = 24;

type Bucket = {
  count: number;
  windowStart: number;
};

const memoryBuckets = new Map<string, Bucket>();

function checkMemoryLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const existing = memoryBuckets.get(clientKey);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    memoryBuckets.set(clientKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_RUNS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - existing.windowStart);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkPlaygroundRateLimit(
  clientKey: string,
  prisma?: PrismaClient,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (prisma === undefined) {
    return checkMemoryLimit(clientKey);
  }

  const now = new Date();
  const existing = await prisma.playgroundRateBucket.findUnique({
    where: { clientKey },
  });

  if (!existing || now.getTime() - existing.windowStart.getTime() >= WINDOW_MS) {
    await prisma.playgroundRateBucket.upsert({
      where: { clientKey },
      create: { clientKey, windowStart: now, count: 1 },
      update: { windowStart: now, count: 1 },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_RUNS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now.getTime() - existing.windowStart.getTime());
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  await prisma.playgroundRateBucket.update({
    where: { clientKey },
    data: { count: existing.count + 1 },
  });
  return { allowed: true, retryAfterSeconds: 0 };
}
