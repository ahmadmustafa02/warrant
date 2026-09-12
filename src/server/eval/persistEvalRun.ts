import type {
  GuardMode,
  Prisma,
  PrismaClient,
  ProvenanceKind,
  SuiteKind,
} from '@prisma/client';
import { toPrismaCaseOutcome } from '@/eval/caseOutcomeMap';
import type { GuardDecision } from '@/core/authorization/decide';
import type { EvalCaseRunResult } from '@/eval/runEvalCase';
import { computeRunMetrics } from '@/eval/metrics';

function mapAuthorizedBy(decision: GuardDecision): ProvenanceKind | null {
  if (!decision.allowed || decision.authorizedBy === undefined) {
    return null;
  }
  return decision.authorizedBy === 'USER_WARRANT' ? 'USER' : 'SYSTEM';
}

function sideEffectFired(result: EvalCaseRunResult): boolean {
  return result.sandbox.signals.emailSent || result.sandbox.signals.keyRead;
}

export async function createEvalRun(
  prisma: PrismaClient,
  options: {
    targetId: string;
    suiteIds: string[];
    guardMode: GuardMode;
    targetModelId: string;
  },
) {
  return prisma.evalRun.create({
    data: {
      targetId: options.targetId,
      guardMode: options.guardMode,
      targetModelId: options.targetModelId,
      status: 'RUNNING',
      suites: { connect: options.suiteIds.map((id) => ({ id })) },
    },
  });
}

export async function persistEvalCase(
  prisma: PrismaClient,
  options: {
    runId: string;
    payloadId: string;
    suiteKind: SuiteKind;
    result: EvalCaseRunResult;
  },
): Promise<void> {
  const { result } = options;
  const transcript = result.sandbox.transcript as Prisma.InputJsonValue;

  const evalCase = await prisma.evalCase.create({
    data: {
      runId: options.runId,
      payloadId: options.payloadId,
      outcome: toPrismaCaseOutcome(result.outcome),
      hijacked: result.sandbox.hijacked,
      canaryLeaked: result.sandbox.signals.canaryLeaked,
      sideEffectFired: sideEffectFired(result),
      calledTools: [...result.sandbox.calledTools],
      blockedTools: [...result.sandbox.blockedTools],
      finalAnswer: result.sandbox.finalAnswer || null,
      transcript,
      latencyMs: result.sandbox.latencyMs,
      promptTokens: result.sandbox.usage.promptTokens,
      completionTokens: result.sandbox.usage.completionTokens,
    },
  });

  for (const decision of result.sandbox.guardDecisions) {
    await prisma.guardDecision.create({
      data: {
        caseId: evalCase.id,
        toolName: decision.tool,
        riskTier: decision.riskTier ?? 'SENSITIVE',
        allowed: decision.allowed,
        authorizedBy: mapAuthorizedBy(decision),
        taintSources: [...decision.taintSources],
        reason: decision.reason,
        latencyMs: 0,
      },
    });
  }
}

export async function finalizeEvalRun(
  prisma: PrismaClient,
  runId: string,
  caseResults: readonly EvalCaseRunResult[],
): Promise<void> {
  const summary = computeRunMetrics(caseResults.map((entry) => entry.metricInput));
  const usage = caseResults.reduce(
    (acc, entry) => ({
      prompt: acc.prompt + entry.sandbox.usage.promptTokens,
      completion: acc.completion + entry.sandbox.usage.completionTokens,
    }),
    { prompt: 0, completion: 0 },
  );

  await prisma.runMetric.create({
    data: {
      runId,
      attacksTotal: summary.attacksTotal,
      attacksStopped: summary.attacksStopped,
      attackStopRate: summary.attackStopRate,
      benignTotal: summary.benignTotal,
      benignPassed: summary.benignPassed,
      benignPassRate: summary.benignPassRate,
      errorCount: summary.errorCount,
      p95GuardLatencyMs: summary.p95GuardLatencyMs,
      totalPromptTokens: usage.prompt,
      totalCompletionTokens: usage.completion,
    },
  });

  await prisma.evalRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETED',
      finishedAt: new Date(),
    },
  });
}

export async function failEvalRun(
  prisma: PrismaClient,
  runId: string,
  error: string,
): Promise<void> {
  await prisma.evalRun.update({
    where: { id: runId },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      error,
    },
  });
}
