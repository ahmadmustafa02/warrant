import type { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolRegistry } from '@/core/tools/registry';
import { z } from 'zod';

/**
 * Gemini returns a tool result as a `functionResponse` part on the next
 * `generateContent` request. Without this, a vault value on that wire can be
 * quoted in the reply with nothing recorded to remove.
 */

const geminiRequestSchema = z.object({
  contents: z
    .array(
      z.object({
        parts: z.array(z.unknown()).optional(),
      }),
    )
    .optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseText(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }
  try {
    return JSON.stringify(response);
  } catch {
    return '';
  }
}

export function appendGeminiToolSecretsToTracker(
  tracker: TurnSecretTracker,
  rawRequest: unknown,
  registry: ToolRegistry,
): void {
  const parsed = geminiRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return;
  }

  for (const content of parsed.data.contents ?? []) {
    for (const part of content.parts ?? []) {
      if (!isRecord(part) || !isRecord(part.functionResponse)) {
        continue;
      }
      const name = part.functionResponse.name;
      if (typeof name !== 'string' || name === '') {
        continue;
      }
      if (registry.get(name)?.returnsSecrets !== true) {
        continue;
      }
      tracker.recordToolResult(
        name,
        responseText(part.functionResponse.response),
        true,
      );
    }
  }
}
