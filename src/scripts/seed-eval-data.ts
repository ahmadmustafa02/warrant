import 'dotenv/config';
import { prisma } from '@/server/db';
import { seedAuthoredEvalData } from '@/server/eval/seedAuthoredSuites';
import { seedExternalHeldOutPlaceholder } from '@/server/eval/seedExternalHeldOutPlaceholder';
import { seedHeldOutEvalData } from '@/server/eval/seedHeldOutSuites';

async function main(): Promise<void> {
  await seedAuthoredEvalData(prisma);
  await seedHeldOutEvalData(prisma);
  await seedExternalHeldOutPlaceholder(prisma);
  const counts = await prisma.payload.groupBy({
    by: ['suiteId'],
    _count: { _all: true },
  });
  console.log(JSON.stringify({ ok: true, payloadCounts: counts }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
