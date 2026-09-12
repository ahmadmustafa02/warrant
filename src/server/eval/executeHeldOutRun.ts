import type { GuardMode, PrismaClient } from '@prisma/client';
import { heldOutPayload } from '@/eval/payloads/heldOutCatalog';
import { runEvalCase } from '@/eval/runEvalCase';
import { computeRunMetrics, formatScorecard } from '@/eval/metrics';
import { HELD_OUT_ATTACK_SUITE_SLUG } from './seedHeldOutSuites';
import {
  createEvalRun,
  failEvalRun,
  finalizeEvalRun,
  persistEvalCase,
} from './persistEvalRun';

export async function executeHeldOutRun(
  prisma: PrismaClient,
  options: {
    guardMode: GuardMode;
    targetSlug: string;
    model?: string;
  },
) {
  const [suite, target] = await Promise.all([
    prisma.suite.findUnique({
      where: { slug: HELD_OUT_ATTACK_SUITE_SLUG },
      include: { payloads: { orderBy: { externalRef: 'asc' } } },
    }),
    prisma.targetAgent.findUnique({ where: { slug: options.targetSlug } }),
  ]);

  if (!suite) {
    throw new Error('held-out suite missing — run pnpm run eval:seed first');
  }
  if (!target) {
    throw new Error(`target agent not found: ${options.targetSlug}`);
  }

  const run = await createEvalRun(prisma, {
    targetId: target.id,
    suiteIds: [suite.id],
    guardMode: options.guardMode,
    targetModelId: options.model ?? target.modelId,
  });

  const caseResults = [];

  try {
    for (const payload of suite.payloads) {
      const authored =
        payload.externalRef === null ? undefined : heldOutPayload(payload.externalRef);
      const result = await runEvalCase({
        suiteKind: 'ATTACK',
        injectionLine: payload.content,
        userTurn: payload.userTurn ?? undefined,
        expectedTools: payload.expectedTools,
        expectedPinnedParameters: authored?.expectedPinnedParameters,
        memoryInjectionLine: authored?.memoryInjectionLine,
        guardMode: options.guardMode,
        model: options.model ?? target.modelId,
      });
      caseResults.push(result);
      await persistEvalCase(prisma, {
        runId: run.id,
        payloadId: payload.id,
        suiteKind: 'ATTACK',
        result,
      });
    }

    await finalizeEvalRun(prisma, run.id, caseResults);
    const scorecard = formatScorecard(
      computeRunMetrics(caseResults.map((entry) => entry.metricInput)),
    );
    return { runId: run.id, scorecard, cases: caseResults };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'held-out eval failed';
    await failEvalRun(prisma, run.id, message);
    throw error;
  }
}
