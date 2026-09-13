import { runSandboxAgent } from '@/agent/runSandboxAgent';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { SuiteKind } from '@prisma/client';
import type { PromptProfile } from '@/agent/prompts';
import type { IntentParseMode } from '@/agent/intent/parseUserIntentLlm';
import {
  DEFAULT_EVAL_USER_TURN,
  DEFAULT_EXPECTED_PINNED_PARAMETERS,
  DEFAULT_EXPECTED_TOOLS,
} from './payloads/types';
import { classifyOutcome } from './classifyOutcome';
import type { CaseMetricInput } from './metrics';

export type EvalCaseRunResult = {
  userTurn: string;
  injectionLine: string;
  suiteKind: SuiteKind;
  outcome: ReturnType<typeof classifyOutcome>;
  metricInput: CaseMetricInput;
  sandbox: Awaited<ReturnType<typeof runSandboxAgent>>;
  errorMessage?: string;
};

export async function runEvalCase(input: {
  suiteKind: SuiteKind;
  injectionLine: string;
  userTurn?: string;
  expectedTools?: readonly string[];
  expectedPinnedParameters?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  memoryInjectionLine?: string;
  lateToolAfterDocumentRead?: boolean;
  guardMode: GuardMode;
  promptProfile?: PromptProfile;
  model?: string;
  intentParseMode?: IntentParseMode;
}): Promise<EvalCaseRunResult> {
  const userTurn = input.userTurn ?? DEFAULT_EVAL_USER_TURN;
  const expectedTools = input.expectedTools ?? DEFAULT_EXPECTED_TOOLS;
  const expectedPinnedParameters =
    input.expectedPinnedParameters ??
    (userTurn === DEFAULT_EVAL_USER_TURN
      ? DEFAULT_EXPECTED_PINNED_PARAMETERS
      : undefined);

  try {
    const sandbox = await runSandboxAgent({
      userTurn,
      guardMode: input.guardMode,
      injectionLine: input.injectionLine,
      promptProfile: input.promptProfile ?? 'NAIVE',
      model: input.model,
      measuredAuthorizedTools: expectedTools,
      measuredPinnedParameters: expectedPinnedParameters,
      memoryInjectionLine: input.memoryInjectionLine,
      ...(input.lateToolAfterDocumentRead === true
        ? { lateToolAvailability: 'AFTER_DOCUMENT_READ' as const }
        : {}),
      ...(input.intentParseMode !== undefined
        ? { intentParseMode: input.intentParseMode }
        : {}),
    });

    const hadError = false;
    const outcome = classifyOutcome({
      suiteKind: input.suiteKind,
      hijacked: sandbox.hijacked,
      blockedTools: sandbox.blockedTools,
      expectedTools,
      hadError,
    });

    const metricInput: CaseMetricInput = {
      suiteKind: input.suiteKind,
      hijacked: sandbox.hijacked,
      blockedTools: sandbox.blockedTools,
      expectedTools,
      hadError,
      guardDecisionLatencyMs: sandbox.guardDecisions.map(() => 0),
    };

    return {
      userTurn,
      injectionLine: input.injectionLine,
      suiteKind: input.suiteKind,
      outcome,
      metricInput,
      sandbox,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'eval case failed';
    const metricInput: CaseMetricInput = {
      suiteKind: input.suiteKind,
      hijacked: false,
      blockedTools: [],
      expectedTools,
      hadError: true,
      guardDecisionLatencyMs: [],
    };
    return {
      userTurn,
      injectionLine: input.injectionLine,
      suiteKind: input.suiteKind,
      outcome: 'ERROR',
      metricInput,
      sandbox: {
        finalAnswer: '',
        hijacked: false,
        signals: {
          emailSent: false,
          keyRead: false,
          canaryLeaked: false,
          unauthorizedDocumentRead: false,
          unauthorizedFetch: false,
          unauthorizedWorkerDelegate: false,
          unauthorizedLateToolRead: false,
          calledTools: [],
        },
        calledTools: [],
        guardDecisions: [],
        blockedTools: [],
        wouldBlockTools: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        steps: 0,
        warrantTools: [],
        transcript: [],
        latencyMs: 0,
        drifts: [],
      },
      errorMessage: message,
    };
  }
}
