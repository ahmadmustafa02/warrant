import { z } from 'zod';
import type { CanonicalRequest, CanonicalToolCall, DiscoveredTool } from './canonical';

const textBlockSchema = z.object({ type: z.literal('text'), text: z.string() });
export const toolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
});

export const toolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().min(1),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
});

const anthropicMessageSchema = z.object({
  role: z.string(),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        textBlockSchema,
        toolUseBlockSchema,
        toolResultBlockSchema,
        z.object({ type: z.string() }),
      ]),
    ),
  ]),
});

const anthropicToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  input_schema: z.unknown().optional(),
});

export const anthropicMessagesRequestSchema = z.object({
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  messages: z.array(anthropicMessageSchema),
  tools: z.array(anthropicToolSchema).optional(),
});

export const anthropicMessagesResponseSchema = z.object({
  content: z.array(
    z.union([textBlockSchema, toolUseBlockSchema, z.object({ type: z.string() })]),
  ),
});

export class AnthropicWireParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnthropicWireParseError';
  }
}

function schemaParameterNames(inputSchema: unknown): readonly string[] {
  if (typeof inputSchema !== 'object' || inputSchema === null) {
    return [];
  }
  const properties = (inputSchema as { properties?: unknown }).properties;
  if (typeof properties !== 'object' || properties === null) {
    return [];
  }
  return Object.keys(properties);
}

function userTextFromContent(
  content: z.infer<typeof anthropicMessageSchema>['content'],
): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((block): block is z.infer<typeof textBlockSchema> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function parseAnthropicRequest(body: unknown): CanonicalRequest {
  const parsed = anthropicMessagesRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnthropicWireParseError('request is not an Anthropic messages call');
  }

  const userTurns = parsed.data.messages.filter((message) => message.role === 'user');
  const latest = userTurns[userTurns.length - 1];

  const tools: DiscoveredTool[] = (parsed.data.tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    parameterNames: schemaParameterNames(tool.input_schema),
  }));

  return {
    model: parsed.data.model ?? 'unknown',
    userRequest: latest === undefined ? '' : userTextFromContent(latest.content),
    tools: Object.freeze(tools),
  };
}

export function parseAnthropicToolCalls(body: unknown): readonly CanonicalToolCall[] {
  const parsed = anthropicMessagesResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnthropicWireParseError('response is not an Anthropic messages result');
  }

  const calls: CanonicalToolCall[] = [];
  for (const block of parsed.data.content) {
    const toolUse = toolUseBlockSchema.safeParse(block);
    if (!toolUse.success) {
      continue;
    }
    calls.push({
      id: toolUse.data.id,
      name: toolUse.data.name,
      rawArguments: JSON.stringify(toolUse.data.input),
    });
  }
  return Object.freeze(calls);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripDeniedAnthropicToolUses(
  rawResponse: unknown,
  denialsByCallId: ReadonlyMap<string, string>,
): unknown {
  if (denialsByCallId.size === 0 || !isRecord(rawResponse)) {
    return rawResponse;
  }

  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.content)) {
    return rawResponse;
  }

  const removedReasons: string[] = [];
  clone.content = clone.content.filter((block) => {
    if (!isRecord(block) || block.type !== 'tool_use' || typeof block.id !== 'string') {
      return true;
    }
    const reason = denialsByCallId.get(block.id);
    if (reason === undefined) {
      return true;
    }
    removedReasons.push(reason);
    return false;
  });

  if (removedReasons.length > 0 && Array.isArray(clone.content)) {
    const hasToolUse = clone.content.some(
      (block) => isRecord(block) && block.type === 'tool_use',
    );
    if (!hasToolUse) {
      clone.content.push({
        type: 'text',
        text: removedReasons.join(' '),
      });
      clone.stop_reason = 'end_turn';
    }
  }

  return clone;
}

export function redactAnthropicTextBlocks(
  rawResponse: unknown,
  redact: (text: string) => string,
): unknown {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse.content)) {
    return rawResponse;
  }

  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.content)) {
    return rawResponse;
  }

  for (const block of clone.content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
      block.text = redact(block.text);
    }
  }

  return clone;
}
