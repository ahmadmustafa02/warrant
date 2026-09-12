import 'dotenv/config';
import { prisma } from '@/server/db';
import { EVAL_SUITE_SLUGS } from '@/server/eval/seedAuthoredSuites';
import { executeHeldOutRun } from '@/server/eval/executeHeldOutRun';
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
  const guardMode = parseGuardMode(readFlag('--guard'));
  const summary = await executeHeldOutRun(prisma, {
    guardMode,
    targetSlug: EVAL_SUITE_SLUGS.target,
  });
  console.log('Held-out scorecard (report separately from tuned suites)');
  console.log(summary.scorecard);
  console.log(JSON.stringify({ runId: summary.runId }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
