import { prisma } from '@/server/db';
import { loadPlaygroundReplay } from '@/server/playground/loadPlaygroundReplay';
import { playgroundRequestSchema } from '@/server/playground/playgroundRequestSchema';

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
