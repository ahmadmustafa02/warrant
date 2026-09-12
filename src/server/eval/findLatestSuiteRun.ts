import type { GuardMode, PrismaClient } from '@prisma/client';

export async function findLatestCompletedRunForSuite(
  prisma: PrismaClient,
  options: {
    guardMode: GuardMode;
    suiteSlug: string;
  },
) {
  return prisma.evalRun.findFirst({
    where: {
      guardMode: options.guardMode,
      status: 'COMPLETED',
      suites: { some: { slug: options.suiteSlug } },
    },
    orderBy: { startedAt: 'desc' },
    include: { metric: true },
  });
}
