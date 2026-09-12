const WINDOW_MS = 60 * 60 * 1000;
const MAX_RUNS_PER_WINDOW = 24;

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

/**
 * In-process limiter for the public playground. Sufficient for a demo deploy;
 * a multi-instance production host would need a shared store.
 */
export function checkPlaygroundRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(clientKey, { count: 1, windowStart: now });
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
