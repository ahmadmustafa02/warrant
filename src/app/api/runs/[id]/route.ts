import { z } from 'zod';
import { getEvalRun } from '@/server/eval/queries';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return Response.json({ error: 'invalid run id' }, { status: 400 });
  }

  const run = await getEvalRun(parsed.data.id);
  if (!run) {
    return Response.json({ error: 'run not found' }, { status: 404 });
  }

  return Response.json({
    id: run.id,
    status: run.status,
    guardMode: run.guardMode,
    targetModelId: run.targetModelId,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    metric: run.metric,
    cases: run.cases.map((entry) => ({
      id: entry.id,
      outcome: entry.outcome,
      hijacked: entry.hijacked,
      category: entry.payload.category,
      calledTools: entry.calledTools,
      blockedTools: entry.blockedTools,
    })),
  });
}
