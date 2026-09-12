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
  const clientKey = clientKeyFromRequest(request);
  const limit = checkPlaygroundRateLimit(clientKey);
  if (!limit.allowed) {
    return Response.json(
      {
        error:
          'Playground rate limit reached. Try again later or run locally with pnpm run run:sandbox.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

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

  try {
    const result = await runPlaygroundSession(parsed.data);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Playground run failed unexpectedly.';
    return Response.json({ error: message }, { status: 502 });
  }
}
