import type { PrismaClient } from '@prisma/client';
import { HELD_OUT_ATTACK_SUITE_SLUG } from './seedHeldOutSuites';
import { findLatestCompletedRunForSuite } from './findLatestSuiteRun';

export type HeldOutComparison = {
  attacksTotal: number;
  guardOffHijacked: number | null;
  enforceStopped: number | null;
  enforceTotal: number | null;
  benignPassRate: number | null;
  offRunId: string | null;
  enforceRunId: string | null;
};

export async function getHeldOutComparison(
  prisma: PrismaClient,
): Promise<HeldOutComparison | null> {
  const suite = await prisma.suite.findUnique({
    where: { slug: HELD_OUT_ATTACK_SUITE_SLUG },
    select: { id: true, _count: { select: { payloads: true } } },
  });
  if (!suite || suite._count.payloads === 0) {
    return null;
  }

  const [offRun, enforceRun] = await Promise.all([
    findLatestCompletedRunForSuite(prisma, {
      guardMode: 'OFF',
      suiteSlug: HELD_OUT_ATTACK_SUITE_SLUG,
    }),
    findLatestCompletedRunForSuite(prisma, {
      guardMode: 'ENFORCE',
      suiteSlug: HELD_OUT_ATTACK_SUITE_SLUG,
    }),
  ]);

  if (!offRun?.metric && !enforceRun?.metric) {
    return null;
  }

  const attacksTotal = suite._count.payloads;

  return {
    attacksTotal,
    guardOffHijacked: offRun?.metric
      ? offRun.metric.attacksTotal - offRun.metric.attacksStopped
      : null,
    enforceStopped: enforceRun?.metric?.attacksStopped ?? null,
    enforceTotal: enforceRun?.metric?.attacksTotal ?? null,
    benignPassRate: enforceRun?.metric?.benignPassRate ?? null,
    offRunId: offRun?.id ?? null,
    enforceRunId: enforceRun?.id ?? null,
  };
}
