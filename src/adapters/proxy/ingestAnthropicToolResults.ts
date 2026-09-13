import type { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolRegistry } from '@/core/tools/registry';
import {
  anthropicMessagesRequestSchema,
  toolResultBlockSchema,
  toolUseBlockSchema,
} from './anthropicWire';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toolResultText(content: string | readonly unknown[] | undefined): string {
  if (content === undefined) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((block): block is { type: 'text'; text: string } => {
      return isRecord(block) && block.type === 'text' && typeof block.text === 'string';
    })
    .map((block) => block.text)
    .join('\n');
}

/** Tracks secret-bearing tool results already present in an Anthropic messages request. */
export function appendAnthropicToolSecretsToTracker(
  tracker: TurnSecretTracker,
  rawRequest: unknown,
  registry: ToolRegistry,
): void {
  const parsed = anthropicMessagesRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return;
  }

  const useIdToTool = new Map<string, string>();
  for (const message of parsed.data.messages) {
    if (message.role !== 'assistant') {
      continue;
    }
    const blocks = typeof message.content === 'string' ? [] : message.content;
    for (const block of blocks) {
      const toolUse = toolUseBlockSchema.safeParse(block);
      if (toolUse.success) {
        useIdToTool.set(toolUse.data.id, toolUse.data.name);
      }
    }
  }

  for (const message of parsed.data.messages) {
    if (message.role !== 'user' || typeof message.content === 'string') {
      continue;
    }
    for (const block of message.content) {
      const result = toolResultBlockSchema.safeParse(block);
      if (!result.success) {
        continue;
      }
      const toolName = useIdToTool.get(result.data.tool_use_id);
      if (toolName === undefined) {
        continue;
      }
      if (registry.get(toolName)?.returnsSecrets !== true) {
        continue;
      }
      tracker.recordToolResult(toolName, toolResultText(result.data.content), true);
    }
  }
}
