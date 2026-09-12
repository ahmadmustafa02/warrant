import 'dotenv/config';
import { prisma } from '@/server/db';
import { EVAL_SUITE_SLUGS } from '@/server/eval/seedAuthoredSuites';
import { executeSuiteRun } from '@/server/eval/executeSuiteRun';
import type { GuardMode } from '@prisma/client';

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseGuardMode(raw: string | undefined): GuardMode {
  const value = (raw ?? 'ENFORCE').toUpperCase();
  if (value === 'OFF' || value === 'ENFORCE' || value === 'DETECT_ONLY') {
    return value;
  }
  throw new Error(`invalid guard mode: ${raw}`);
}

async function main(): Promise<void> {
  const suiteSlug = readFlag('--suite') ?? EVAL_SUITE_SLUGS.attacks;
  const guardMode = parseGuardMode(readFlag('--guard'));
  const limitRaw = readFlag('--limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (limitRaw && Number.isNaN(limit)) {
    throw new Error('--limit must be a number');
  }

  const summary = await executeSuiteRun(prisma, {
    suiteSlug,
    guardMode,
    targetSlug: EVAL_SUITE_SLUGS.target,
    limit,
  });

  console.log(summary.scorecard);
  console.log(
    JSON.stringify(
      {
        runId: summary.runId,
        cases: summary.cases.map((entry) => ({
          outcome: entry.outcome,
          hijacked: entry.sandbox.hijacked,
          blockedTools: entry.sandbox.blockedTools,
          calledTools: entry.sandbox.calledTools,
          error: entry.errorMessage,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
