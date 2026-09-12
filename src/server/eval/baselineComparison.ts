import type { PrismaClient } from '@prisma/client';
import { DEFAULT_PROMPT_GUARD_THRESHOLD } from '@/eval/baseline/promptGuardScore';
import { serverEnv } from '@/lib/env';
import { EVAL_SUITE_SLUGS } from './seedAuthoredSuites';
import { findLatestCompletedRunForSuite } from './findLatestSuiteRun';

export type MeasuredComparisonRow = {
  id: 'guard_off' | 'prompt_guard' | 'warrant_enforce';
  label: string;
  headline: string;
  detail: string;
  tone: 'hijack' | 'blocked' | 'safe';
};

export type MeasuredComparison = {
  threshold: number;
  detectorModel: string;
  attacksTotal: number;
  rows: MeasuredComparisonRow[];
  warrantRunId: string | null;
  baselineScoredAt: Date | null;
};

export async function getMeasuredComparison(
  prisma: PrismaClient,
): Promise<MeasuredComparison | null> {
  const detectorModel = serverEnv().GROQ_BASELINE_GUARD_MODEL;
  const threshold = DEFAULT_PROMPT_GUARD_THRESHOLD;

  const attackSuite = await prisma.suite.findUnique({
    where: { slug: EVAL_SUITE_SLUGS.attacks },
    select: { id: true, _count: { select: { payloads: true } } },
  });

  if (!attackSuite || attackSuite._count.payloads === 0) {
    return null;
  }

  const attacksTotal = attackSuite._count.payloads;

  const [baselineRows, guardOffRun, enforceRun] = await Promise.all([
    prisma.baselineResult.findMany({
      where: {
        detectorModel,
        threshold,
        payload: { suiteId: attackSuite.id },
      },
      orderBy: { createdAt: 'desc' },
    }),
    findLatestCompletedRunForSuite(prisma, {
      guardMode: 'OFF',
      suiteSlug: EVAL_SUITE_SLUGS.attacks,
    }),
    findLatestCompletedRunForSuite(prisma, {
      guardMode: 'ENFORCE',
      suiteSlug: EVAL_SUITE_SLUGS.attacks,
    }),
  ]);

  const latestBaselineByPayload = new Map<string, (typeof baselineRows)[number]>();
  for (const row of baselineRows) {
    if (!latestBaselineByPayload.has(row.payloadId)) {
      latestBaselineByPayload.set(row.payloadId, row);
    }
  }

  const promptGuardFlagged = [...latestBaselineByPayload.values()].filter(
    (row) => row.flagged,
  ).length;

  let baselineScoredAt: Date | null = null;
  for (const row of baselineRows) {
    if (!baselineScoredAt || row.createdAt > baselineScoredAt) {
      baselineScoredAt = row.createdAt;
    }
  }

  const rows: MeasuredComparisonRow[] = [];

  if (guardOffRun?.metric) {
    const hijacked =
      guardOffRun.metric.attacksTotal - guardOffRun.metric.attacksStopped;
    rows.push({
      id: 'guard_off',
      label: 'Guard off',
      headline: `${hijacked} / ${guardOffRun.metric.attacksTotal}`,
      detail: `hijacked on ${guardOffRun.targetModelId}`,
      tone: 'hijack',
    });
  }

  if (latestBaselineByPayload.size > 0) {
    rows.push({
      id: 'prompt_guard',
      label: 'PromptGuard',
      headline: `${promptGuardFlagged} / ${attacksTotal}`,
      detail: `flagged at threshold ${threshold}`,
      tone: 'blocked',
    });
  }

  if (enforceRun?.metric) {
    const stopPct = Math.round(enforceRun.metric.attackStopRate * 100);
    const passPct = Math.round(enforceRun.metric.benignPassRate * 100);
    rows.push({
      id: 'warrant_enforce',
      label: 'Warrant enforce',
      headline: `${stopPct}% stop · ${passPct}% pass`,
      detail: `${enforceRun.metric.attacksStopped}/${enforceRun.metric.attacksTotal} attacks stopped · ${enforceRun.metric.benignPassed}/${enforceRun.metric.benignTotal} benign passed`,
      tone: 'safe',
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    threshold,
    detectorModel,
    attacksTotal,
    rows,
    warrantRunId: enforceRun?.id ?? null,
    baselineScoredAt,
  };
}
