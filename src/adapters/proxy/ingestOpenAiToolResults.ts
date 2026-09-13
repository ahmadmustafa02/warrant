import type { ToolRegistry } from '@/core/tools/registry';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import { messageText, openAiChatRequestSchema } from './openaiWire';

/**
 * Reconstructs which tool produced each tool-role message so secret results can be
 * tracked for output redaction on the model's next reply.
 */
export function appendOpenAiToolSecretsToTracker(
  tracker: TurnSecretTracker,
  rawRequest: unknown,
  registry: ToolRegistry,
): void {
  const parsed = openAiChatRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return;
  }

  const callIdToTool = new Map<string, string>();
  for (const message of parsed.data.messages) {
    for (const call of message.tool_calls ?? []) {
      callIdToTool.set(call.id, call.function.name);
    }
  }

  for (const message of parsed.data.messages) {
    if (message.role !== 'tool' || message.tool_call_id === undefined) {
      continue;
    }
    const toolName = callIdToTool.get(message.tool_call_id);
    if (toolName === undefined) {
      continue;
    }
    if (registry.get(toolName)?.returnsSecrets !== true) {
      continue;
    }
    tracker.recordToolResult(toolName, messageText(message.content), true);
  }
}

export function buildSecretTrackerFromOpenAiRequest(
  rawRequest: unknown,
  registry: ToolRegistry,
): TurnSecretTracker {
  const tracker = new TurnSecretTracker();
  appendOpenAiToolSecretsToTracker(tracker, rawRequest, registry);
  return tracker;
}
