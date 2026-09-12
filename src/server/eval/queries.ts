import { prisma } from '@/server/db';

export async function listEvalRuns() {
  return prisma.evalRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      metric: true,
      target: true,
      suites: { select: { slug: true, name: true, kind: true } },
      _count: { select: { cases: true } },
    },
  });
}

export async function getEvalRun(id: string) {
  return prisma.evalRun.findUnique({
    where: { id },
    include: {
      metric: true,
      target: true,
      suites: true,
      cases: {
        orderBy: { createdAt: 'asc' },
        include: {
          payload: true,
          decisions: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
}

export async function getEvalCase(runId: string, caseId: string) {
  return prisma.evalCase.findFirst({
    where: { id: caseId, runId },
    include: {
      payload: { include: { suite: true } },
      decisions: { orderBy: { createdAt: 'asc' } },
      run: {
        include: { metric: true, target: true },
      },
    },
  });
}

export async function listSuitesWithPayloads() {
  return prisma.suite.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      payloads: { orderBy: { externalRef: 'asc' } },
    },
  });
}

export async function countEvalOverview() {
  const [runCount, caseCount, latest] = await Promise.all([
    prisma.evalRun.count(),
    prisma.evalCase.count(),
    prisma.evalRun.findFirst({
      orderBy: { startedAt: 'desc' },
      include: { metric: true },
    }),
  ]);

  return { runCount, caseCount, latest };
}
