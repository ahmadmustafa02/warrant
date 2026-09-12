import type { GuardMode, PrismaClient } from '@prisma/client';
import { runEvalCase } from '@/eval/runEvalCase';
import type { EvalCaseRunResult } from '@/eval/runEvalCase';
import { computeRunMetrics, formatScorecard } from '@/eval/metrics';
import {
  createEvalRun,
  failEvalRun,
  finalizeEvalRun,
  persistEvalCase,
} from './persistEvalRun';

export type SuiteRunSummary = {
  runId: string;
  scorecard: string;
  cases: EvalCaseRunResult[];
};

export async function executeSuiteRun(
  prisma: PrismaClient,
  options: {
    suiteSlug: string;
    guardMode: GuardMode;
    targetSlug: string;
    model?: string;
    limit?: number;
  },
): Promise<SuiteRunSummary> {
  const suite = await prisma.suite.findUnique({
    where: { slug: options.suiteSlug },
    include: { payloads: { orderBy: { externalRef: 'asc' } } },
  });
  if (!suite) {
    throw new Error(`suite not found: ${options.suiteSlug}`);
  }

  const target = await prisma.targetAgent.findUnique({
    where: { slug: options.targetSlug },
  });
  if (!target) {
    throw new Error(`target agent not found: ${options.targetSlug}`);
  }

  const payloads = options.limit
    ? suite.payloads.slice(0, options.limit)
    : suite.payloads;

  const run = await createEvalRun(prisma, {
    targetId: target.id,
    suiteIds: [suite.id],
    guardMode: options.guardMode,
    targetModelId: options.model ?? target.modelId,
  });

  const caseResults: EvalCaseRunResult[] = [];

  try {
    for (const payload of payloads) {
      const result = await runEvalCase({
        suiteKind: suite.kind,
        injectionLine: payload.content,
        userTurn: payload.userTurn ?? undefined,
        expectedTools: payload.expectedTools,
        guardMode: options.guardMode,
        model: options.model ?? target.modelId,
      });

      caseResults.push(result);

      await persistEvalCase(prisma, {
        runId: run.id,
        payloadId: payload.id,
        suiteKind: suite.kind,
        result,
      });
    }

    await finalizeEvalRun(prisma, run.id, caseResults);

    const scorecard = formatScorecard(
      computeRunMetrics(caseResults.map((entry) => entry.metricInput)),
    );

    return { runId: run.id, scorecard, cases: caseResults };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'suite run failed';
    await failEvalRun(prisma, run.id, message);
    throw error;
  }
}
