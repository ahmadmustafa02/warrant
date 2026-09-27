import type { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolRegistry } from '@/core/tools/registry';
import { z } from 'zod';

/**
 * Responses API tool results arrive as `function_call_output` items, not chat
 * `role: tool` messages. The secret tracker has to read that shape or a credential
 * returned on this wire can be quoted back out with nothing to redact.
 */

const outputPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

const inputItemSchema = z.object({
  type: z.string().optional(),
  call_id: z.string().optional(),
  name: z.string().optional(),
  output: z.union([z.string(), z.array(outputPartSchema)]).optional(),
});

const responsesInputSchema = z.object({
  input: z.array(inputItemSchema),
});

function outputText(output: z.infer<typeof inputItemSchema>['output']): string {
  if (typeof output === 'string') {
    return output;
  }
  return (output ?? [])
    .map((part) => part.text ?? '')
    .filter((text) => text !== '')
    .join('\n');
}

export function appendResponsesToolSecretsToTracker(
  tracker: TurnSecretTracker,
  rawRequest: unknown,
  registry: ToolRegistry,
): void {
  const parsed = responsesInputSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return;
  }

  const callIdToTool = new Map<string, string>();
  for (const item of parsed.data.input) {
    if (
      item.type === 'function_call' &&
      item.call_id !== undefined &&
      item.name !== undefined &&
      item.name !== ''
    ) {
      callIdToTool.set(item.call_id, item.name);
    }
  }

  for (const item of parsed.data.input) {
    if (item.type !== 'function_call_output' || item.call_id === undefined) {
      continue;
    }
    const toolName = callIdToTool.get(item.call_id);
    if (toolName === undefined) {
      continue;
    }
    if (registry.get(toolName)?.returnsSecrets !== true) {
      continue;
    }
    tracker.recordToolResult(toolName, outputText(item.output), true);
  }
}
