import type { GuardMode, PrismaClient } from '@prisma/client';
import { authoredPayload } from '@/eval/payloads/catalog';
import { runEvalCase } from '@/eval/runEvalCase';
import type { EvalCaseRunResult } from '@/eval/runEvalCase';
import { computeRunMetrics, formatScorecard } from '@/eval/metrics';
import { EVAL_SUITE_SLUGS } from './seedAuthoredSuites';
import {
  createEvalRun,
  failEvalRun,
  finalizeEvalRun,
  persistEvalCase,
} from './persistEvalRun';

export async function executeCombinedEvalRun(
  prisma: PrismaClient,
  options: {
    guardMode: GuardMode;
    targetSlug: string;
    model?: string;
    limitPerSuite?: number;
  },
) {
  const [attackSuite, benignSuite, target] = await Promise.all([
    prisma.suite.findUnique({
      where: { slug: EVAL_SUITE_SLUGS.attacks },
      include: { payloads: { orderBy: { externalRef: 'asc' } } },
    }),
    prisma.suite.findUnique({
      where: { slug: EVAL_SUITE_SLUGS.benign },
      include: { payloads: { orderBy: { externalRef: 'asc' } } },
    }),
    prisma.targetAgent.findUnique({ where: { slug: options.targetSlug } }),
  ]);

  if (!attackSuite || !benignSuite) {
    throw new Error('authored suites missing — run pnpm run eval:seed first');
  }
  if (!target) {
    throw new Error(`target agent not found: ${options.targetSlug}`);
  }

  const limit = options.limitPerSuite;
  const attackPayloads = limit
    ? attackSuite.payloads.slice(0, limit)
    : attackSuite.payloads;
  const benignPayloads = limit
    ? benignSuite.payloads.slice(0, limit)
    : benignSuite.payloads;

  const run = await createEvalRun(prisma, {
    targetId: target.id,
    suiteIds: [attackSuite.id, benignSuite.id],
    guardMode: options.guardMode,
    targetModelId: options.model ?? target.modelId,
  });

  const caseResults: EvalCaseRunResult[] = [];

  const runPayloads = async (
    suiteKind: 'ATTACK' | 'BENIGN',
    payloads: typeof attackSuite.payloads,
  ) => {
    for (const payload of payloads) {
      const authored =
        payload.externalRef === null ? undefined : authoredPayload(payload.externalRef);
      const result = await runEvalCase({
        suiteKind,
        injectionLine: payload.content,
        userTurn: payload.userTurn ?? undefined,
        expectedTools: payload.expectedTools,
        expectedPinnedParameters: authored?.expectedPinnedParameters,
        lateToolAfterDocumentRead: authored?.lateToolAfterDocumentRead,
        guardMode: options.guardMode,
        model: options.model ?? target.modelId,
      });
      caseResults.push(result);
      await persistEvalCase(prisma, {
        runId: run.id,
        payloadId: payload.id,
        suiteKind,
        result,
      });
    }
  };

  try {
    await runPayloads('ATTACK', attackPayloads);
    await runPayloads('BENIGN', benignPayloads);
    await finalizeEvalRun(prisma, run.id, caseResults);

    const scorecard = formatScorecard(
      computeRunMetrics(caseResults.map((entry) => entry.metricInput)),
    );

    return { runId: run.id, scorecard, cases: caseResults };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'combined eval failed';
    await failEvalRun(prisma, run.id, message);
    throw error;
  }
}
