import 'dotenv/config';
import { prisma } from '@/server/db';
import { runPromptGuardBaseline } from '@/server/eval/runPromptGuardBaseline';

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const thresholdRaw = readFlag('--threshold');
  const threshold = thresholdRaw ? Number.parseFloat(thresholdRaw) : undefined;

  const summary = await runPromptGuardBaseline(prisma, { threshold });

  console.log(
    [
      'Prompt Guard baseline (authored document-injection lines)',
      `  Model: ${summary.detectorModel}`,
      `  Threshold: ${summary.threshold}`,
      `  Flagged: ${summary.flagged}/${summary.attacksTotal}`,
    ].join('\n'),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
