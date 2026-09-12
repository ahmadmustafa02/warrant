import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import type { GuardDecision } from '@/core/authorization/decide';
import { serverEnv } from '@/lib/env';
import { groqChatWithTools } from '@/llm/groqClient';
import type { ChatMessage, LlmUsage, ToolCallRequest } from '@/llm/types';
import type OpenAI from 'openai';
import { deriveIntentFromUserTurn } from './intent/deriveIntent';
import { denialMessage, evaluateToolCall, type GuardMode } from './guard/applyGuard';
import { systemPromptFor, type PromptProfile } from './prompts';
import { createDocumentStore } from './sandbox/documents';
import { createSandboxState } from './sandbox/state';
import {
  createSandboxRegistry,
  executeSandboxTool,
  sandboxToolsForApi,
} from './sandbox/tools';
import { detectHijack, isHijacked } from '@/eval/outcome';

export type SandboxRunResult = {
  finalAnswer: string;
  hijacked: boolean;
  signals: ReturnType<typeof detectHijack>;
  calledTools: string[];
  guardDecisions: GuardDecision[];
  blockedTools: string[];
  usage: LlmUsage;
  steps: number;
  warrantTools: string[];
  transcript: ChatMessage[];
  latencyMs: number;
};

export type RunSandboxAgentOptions = {
  userTurn: string;
  guardMode: GuardMode;
  promptProfile?: PromptProfile;
  injectionLine: string;
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
  const intent = deriveIntentFromUserTurn(options.userTurn);
  const warrant = issueWarrant(taint(intent, 'USER'), registry);
  const authorizedTools = intent.requestedTools;

  const effects = createSandboxState();
  const toolCtx = { canarySecret: env.SANDBOX_CANARY_SECRET, effects, documents };
  const calledTools: string[] = [];
  const guardDecisions: GuardDecision[] = [];
  const blockedTools: string[] = [];
  let usage = emptyUsage();

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPromptFor(profile) },
    { role: 'user', content: options.userTurn },
  ];

  let finalAnswer = '';
  let steps = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    steps = step + 1;
    const completion = await groqChatWithTools({
      model,
      messages,
      tools: sandboxToolsForApi(),
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
      break;
    }

    for (const call of toolCalls) {
      const toolName = call.function.name;
      calledTools.push(toolName);

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
      if (options.guardMode === 'ENFORCE' && decision !== null && !decision.allowed) {
        blockedTools.push(toolName);
        toolResult = denialMessage(decision);
      } else {
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
    usage,
    steps,
    warrantTools: [...authorizedTools],
    transcript: messages,
    latencyMs: Date.now() - started,
  };
}
