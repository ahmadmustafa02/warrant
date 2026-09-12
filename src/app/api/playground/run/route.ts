import { prisma } from '@/server/db';
import { loadPlaygroundReplay } from '@/server/playground/loadPlaygroundReplay';
import { runPlaygroundSession } from '@/server/playground/runPlaygroundSession';
import { playgroundRequestSchema } from '@/server/playground/playgroundRequestSchema';
import { checkPlaygroundRateLimit } from '@/server/playground/rateLimit';

function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get('x-real-ip') ?? 'local-dev';
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const parsed = playgroundRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid playground input.', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.mode === 'replay') {
    try {
      const replay = await loadPlaygroundReplay(
        prisma,
        parsed.data.presetId,
        parsed.data.guardMode,
      );
      if (replay === null) {
        return Response.json({ error: 'Unknown preset.' }, { status: 404 });
      }
      return Response.json(replay);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Replay failed unexpectedly.';
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const clientKey = clientKeyFromRequest(request);
  const limit = await checkPlaygroundRateLimit(clientKey, prisma);
  if (!limit.allowed) {
    return Response.json(
      {
        error:
          'Live playground rate limit reached. Use replay mode or run locally with pnpm run run:sandbox.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const live = parsed.data;
    const result = await runPlaygroundSession({
      userTurn: live.userTurn,
      injectionLine: live.injectionLine,
      guardMode: live.guardMode,
    });
    return Response.json({ ...result, replayed: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Playground run failed unexpectedly.';
    return Response.json({ error: message }, { status: 502 });
  }
}
