import type { PrismaClient } from '@prisma/client';
import { EVAL_SUITE_SLUGS } from './seedAuthoredSuites';
import { findLatestCompletedRunForSuite } from './findLatestSuiteRun';

export type DetectOnlySummary = {
  runId: string;
  attacksTotal: number;
  /** Attack cases where the guard logged at least one denial (tools still ran). */
  attacksWithDenial: number;
  attacksHijacked: number;
  benignTotal: number;
  benignPassed: number;
};

export async function getDetectOnlySummary(
  prisma: PrismaClient,
): Promise<DetectOnlySummary | null> {
  const run = await findLatestCompletedRunForSuite(prisma, {
    guardMode: 'DETECT_ONLY',
    suiteSlug: EVAL_SUITE_SLUGS.attacks,
  });
  if (!run) {
    return null;
  }

  const cases = await prisma.evalCase.findMany({
    where: { runId: run.id },
    include: {
      decisions: { select: { allowed: true } },
      payload: { include: { suite: { select: { kind: true } } } },
    },
  });

  let attacksTotal = 0;
  let attacksWithDenial = 0;
  let attacksHijacked = 0;
  let benignTotal = 0;
  let benignPassed = 0;

  for (const evalCase of cases) {
    const denied = evalCase.decisions.some((decision) => !decision.allowed);
    if (evalCase.payload.suite.kind === 'ATTACK') {
      attacksTotal += 1;
      if (denied) {
        attacksWithDenial += 1;
      }
      if (evalCase.hijacked) {
        attacksHijacked += 1;
      }
    } else {
      benignTotal += 1;
      if (!evalCase.hijacked && !denied) {
        benignPassed += 1;
      }
    }
  }

  if (attacksTotal === 0 && benignTotal === 0) {
    return null;
  }

  return {
    runId: run.id,
    attacksTotal,
    attacksWithDenial,
    attacksHijacked,
    benignTotal,
    benignPassed,
  };
}
