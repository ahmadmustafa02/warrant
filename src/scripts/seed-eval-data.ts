import 'dotenv/config';
import { prisma } from '@/server/db';
import { seedAuthoredEvalData } from '@/server/eval/seedAuthoredSuites';

async function main(): Promise<void> {
  await seedAuthoredEvalData(prisma);
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
