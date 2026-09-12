import { listEvalRuns } from '@/server/eval/queries';

export async function GET(): Promise<Response> {
  const runs = await listEvalRuns();
  return Response.json({
    runs: runs.map((run) => ({
      id: run.id,
      status: run.status,
      guardMode: run.guardMode,
      targetModelId: run.targetModelId,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      caseCount: run._count.cases,
      metric: run.metric
        ? {
            attackStopRate: run.metric.attackStopRate,
            benignPassRate: run.metric.benignPassRate,
            attacksTotal: run.metric.attacksTotal,
            attacksStopped: run.metric.attacksStopped,
            benignTotal: run.metric.benignTotal,
            benignPassed: run.metric.benignPassed,
            errorCount: run.metric.errorCount,
          }
        : null,
    })),
  });
}
