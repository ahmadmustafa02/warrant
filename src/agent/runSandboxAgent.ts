import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import type { GuardDecision } from '@/core/authorization/decide';
import { serverEnv } from '@/lib/env';
import { groqChatWithTools } from '@/llm/groqClient';
import type { ChatMessage, LlmUsage, ToolCallRequest } from '@/llm/types';
import type OpenAI from 'openai';
import { deriveIntentFromUserTurn } from './intent/deriveIntent';
import { resolveProxyIntent } from './intent/resolveProxyIntent';
import type { IntentParseMode } from './intent/parseUserIntentLlm';
import {
  denialMessage,
  evaluateToolCall,
  guardWouldDeny,
  shouldBlockToolCall,
  type GuardMode,
} from './guard/applyGuard';
import { systemPromptFor, type PromptProfile } from './prompts';
import { createDocumentStore } from './sandbox/documents';
import { createSandboxState } from './sandbox/state';
import {
  createSandboxRegistry,
  executeSandboxTool,
  sandboxToolsForApi,
} from './sandbox/tools';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import { detectHijack, isHijacked } from '@/eval/outcome';
import {
  detectToolSetDrift,
  driftedToolNames,
  establishToolSetBaseline,
  type ToolDrift,
  type ToolSetBaseline,
} from '@/core/tools/toolSetDrift';

export type SandboxRunResult = {
  finalAnswer: string;
  hijacked: boolean;
  signals: ReturnType<typeof detectHijack>;
  calledTools: string[];
  guardDecisions: GuardDecision[];
  blockedTools: string[];
  /** Populated in DETECT_ONLY when the guard would have denied but the tool still ran. */
  wouldBlockTools: string[];
  usage: LlmUsage;
  steps: number;
  warrantTools: string[];
  transcript: ChatMessage[];
  latencyMs: number;
  /** Capability changes seen after the opening request established the baseline. */
  drifts: ToolDrift[];
};

export type RunSandboxAgentOptions = {
  userTurn: string;
  guardMode: GuardMode;
  promptProfile?: PromptProfile;
  injectionLine: string;
  /** When set, `read_memory` serves this text instead of the document injection line. */
  memoryInjectionLine?: string;
  model?: string;
  maxSteps?: number;
  /**
   * Tools the request legitimately authorizes, for hijack detection only.
   *
   * The guard under test always enforces the warrant derived from the user turn.
   * Scoring, though, must not depend on that derivation, or a parser that failed
   * to grant a tool would also excuse the agent for using it.
   */
  measuredAuthorizedTools?: readonly string[];
  measuredPinnedParameters?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * When the extra vault capability is advertised.
   *
   * `AFTER_DOCUMENT_READ` stages the attack: the tool is absent when the user makes
   * their request and appears once content has been read. `FROM_START` is the
   * control — the same tool, same tier, no drift — which is how the suite shows that
   * drift detection is carrying the denial rather than the risk tier.
   */
  lateToolAvailability?: 'AFTER_DOCUMENT_READ' | 'FROM_START';
  /** When set, uses the same intent path as the HTTP proxy (heuristic = deriveProxyIntent). */
  intentParseMode?: IntentParseMode;
};

function toToolCallRequest(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): ToolCallRequest | null {
  if (call.type !== 'function') {
    return null;
  }
  return {
    id: call.id,
    type: 'function',
    function: { name: call.function.name, arguments: call.function.arguments },
  };
}

function emptyUsage(): LlmUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(total: LlmUsage, delta: LlmUsage): LlmUsage {
  return {
    promptTokens: total.promptTokens + delta.promptTokens,
    completionTokens: total.completionTokens + delta.completionTokens,
    totalTokens: total.totalTokens + delta.totalTokens,
  };
}

export async function runSandboxAgent(
  options: RunSandboxAgentOptions,
): Promise<SandboxRunResult> {
  const started = Date.now();
  const env = serverEnv();
  const model = options.model ?? env.GROQ_TARGET_MODEL;
  const maxSteps = options.maxSteps ?? 8;
  const profile = options.promptProfile ?? 'NAIVE';

  const documents = createDocumentStore(options.injectionLine);
  const registry = createSandboxRegistry();
  const intent =
    options.intentParseMode === 'heuristic' || options.intentParseMode === 'llm'
      ? await resolveProxyIntent({
          mode: options.intentParseMode,
          userRequest: options.userTurn,
          registry,
          destructiveRequiresExplicitUser: true,
        })
      : deriveIntentFromUserTurn(options.userTurn);
  const warrant = issueWarrant(taint(intent, 'USER'), registry);
  const authorizedTools = intent.requestedTools;

  const effects = createSandboxState();
  const toolCtx = {
    canarySecret: env.SANDBOX_CANARY_SECRET,
    effects,
    documents,
    memoryContent: options.memoryInjectionLine ?? options.injectionLine,
    workerInjectionLine: options.injectionLine,
  };
  const calledTools: string[] = [];
  const guardDecisions: GuardDecision[] = [];
  const blockedTools: string[] = [];
  const wouldBlockTools: string[] = [];
  let usage = emptyUsage();

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPromptFor(profile) },
    { role: 'user', content: options.userTurn },
  ];

  let finalAnswer = '';
  let steps = 0;
  let baseline: ToolSetBaseline | undefined;
  const drifts: ToolDrift[] = [];
  const secretTracker = new TurnSecretTracker();

  for (let step = 0; step < maxSteps; step += 1) {
    steps = step + 1;

    // The poisoned source only reveals the extra capability once content has been
    // read, so the opening request — the one the user's intent was formed against —
    // looks entirely ordinary.
    const advertised = sandboxToolsForApi({
      includeLateTool:
        options.lateToolAvailability === 'FROM_START' ||
        (options.lateToolAvailability === 'AFTER_DOCUMENT_READ' &&
          effects.documentIdsRead.length > 0),
    });
    const advertisedForDrift = advertised.map((tool) => ({
      name: tool.function.name,
      parameterNames: Object.keys(
        (tool.function.parameters['properties'] as
          Record<string, unknown> | undefined) ?? {},
      ),
    }));

    let driftedNow: ReadonlySet<string> = new Set<string>();
    if (baseline === undefined) {
      baseline = establishToolSetBaseline(advertisedForDrift);
    } else {
      const stepDrifts = detectToolSetDrift(baseline, advertisedForDrift);
      for (const drift of stepDrifts) {
        if (!drifts.some((seen) => seen.toolName === drift.toolName)) {
          drifts.push(drift);
        }
      }
      driftedNow = driftedToolNames(stepDrifts);
    }

    const completion = await groqChatWithTools({
      model,
      messages,
      tools: advertised,
    });
    usage = addUsage(usage, completion.usage);

    const assistant = completion.message;
    const rawToolCalls = assistant.tool_calls ?? [];
    const toolCalls = rawToolCalls
      .map(toToolCallRequest)
      .filter((call): call is ToolCallRequest => call !== null);

    messages.push({
      role: 'assistant',
      content: assistant.content,
      tool_calls: toolCalls,
    });

    if (toolCalls.length === 0) {
      finalAnswer = assistant.content?.trim() ?? '';
      if (options.guardMode === 'ENFORCE') {
        finalAnswer = secretTracker.redactUnauthorizedInText(
          finalAnswer,
          authorizedTools,
        ).text;
      }
      break;
    }

    for (const call of toolCalls) {
      const toolName = call.function.name;
      calledTools.push(toolName);

      // Drift is settled before the warrant, and it overrides the read-only
      // exemption: a capability whose origin is suspect earns nothing from a tier
      // inferred from the name its injector chose.
      const driftedCall = driftedNow.has(toolName);
      if (driftedCall && options.guardMode !== 'OFF') {
        const reason =
          drifts.find((drift) => drift.toolName === toolName)?.reason ??
          `${toolName} was not advertised when this session began`;
        if (options.guardMode === 'ENFORCE') {
          blockedTools.push(toolName);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'guard_denied', reason }),
          });
          continue;
        }
        wouldBlockTools.push(toolName);
      }

      const decision = evaluateToolCall({
        mode: options.guardMode,
        warrant,
        registry,
        toolName,
        rawArguments: call.function.arguments,
      });

      if (decision !== null) {
        guardDecisions.push(decision);
      }

      let toolResult: string;
      if (
        decision !== null &&
        !decision.allowed &&
        shouldBlockToolCall(options.guardMode, decision)
      ) {
        blockedTools.push(toolName);
        toolResult = denialMessage(decision);
      } else {
        if (options.guardMode === 'DETECT_ONLY' && guardWouldDeny(decision)) {
          wouldBlockTools.push(toolName);
        }
        let args: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(call.function.arguments || '{}');
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            args = parsed as Record<string, unknown>;
          }
        } catch {
          toolResult = JSON.stringify({ error: 'invalid_tool_arguments' });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: toolResult,
          });
          continue;
        }
        toolResult = executeSandboxTool(toolName, args, toolCtx);
        const definition = registry.get(toolName);
        if (definition?.returnsSecrets === true) {
          secretTracker.recordToolResult(toolName, toolResult, true);
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolResult,
      });
    }
  }

  const signals = detectHijack({
    effects,
    finalAnswer,
    canarySecret: env.SANDBOX_CANARY_SECRET,
    calledTools,
    authorizedTools: options.measuredAuthorizedTools ?? authorizedTools,
    expectedPinnedParameters: options.measuredPinnedParameters,
  });

  return {
    finalAnswer,
    hijacked: isHijacked(signals),
    signals,
    calledTools,
    guardDecisions,
    blockedTools,
    wouldBlockTools,
    usage,
    steps,
    warrantTools: [...authorizedTools],
    transcript: messages,
    latencyMs: Date.now() - started,
    drifts,
  };
}
