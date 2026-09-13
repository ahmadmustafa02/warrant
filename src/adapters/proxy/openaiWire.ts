import { z } from 'zod';
import type { CanonicalRequest, CanonicalToolCall, DiscoveredTool } from './canonical';

/**
 * Schemas cover only the fields the guard reads. Everything else on the wire is
 * forwarded untouched, so rewrites operate on the raw payload rather than on a
 * re-serialized parse — a stripped `usage` or `id` would break the caller's SDK.
 */

const contentPartSchema = z.object({ text: z.string().optional() });

const messageSchema = z.object({
  role: z.string(),
  content: z.union([z.string(), z.array(contentPartSchema), z.null()]).optional(),
});

const toolSchema = z.object({
  function: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.unknown().optional(),
  }),
});

export const openAiChatRequestSchema = z.object({
  model: z.string().optional(),
  messages: z.array(messageSchema),
  tools: z.array(toolSchema).optional(),
});

const toolCallSchema = z.object({
  id: z.string().min(1),
  function: z.object({ name: z.string().min(1), arguments: z.string() }),
});

export const openAiChatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.union([z.string(), z.null()]).optional(),
        tool_calls: z.array(toolCallSchema).optional(),
      }),
    }),
  ),
});

function messageText(content: z.infer<typeof messageSchema>['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .filter((text) => text !== '')
      .join('\n');
  }
  return '';
}

/** Property names of a JSON-schema `parameters` object, or none if absent/malformed. */
function schemaParameterNames(parameters: unknown): readonly string[] {
  if (typeof parameters !== 'object' || parameters === null) {
    return [];
  }
  const properties = (parameters as { properties?: unknown }).properties;
  if (typeof properties !== 'object' || properties === null) {
    return [];
  }
  return Object.keys(properties);
}

export class WireParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WireParseError';
  }
}

export function parseOpenAiRequest(body: unknown): CanonicalRequest {
  const parsed = openAiChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new WireParseError('request is not an OpenAI chat completion');
  }

  const userTurns = parsed.data.messages.filter((message) => message.role === 'user');
  const latest = userTurns[userTurns.length - 1];

  const tools: DiscoveredTool[] = (parsed.data.tools ?? []).map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? '',
    parameterNames: schemaParameterNames(tool.function.parameters),
  }));

  return {
    model: parsed.data.model ?? 'unknown',
    userRequest: latest === undefined ? '' : messageText(latest.content),
    tools: Object.freeze(tools),
  };
}

export function parseOpenAiToolCalls(body: unknown): readonly CanonicalToolCall[] {
  const parsed = openAiChatResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new WireParseError('response is not an OpenAI chat completion');
  }

  const calls: CanonicalToolCall[] = [];
  for (const choice of parsed.data.choices) {
    for (const call of choice.message.tool_calls ?? []) {
      calls.push({
        id: call.id,
        name: call.function.name,
        rawArguments: call.function.arguments,
      });
    }
  }
  return Object.freeze(calls);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Removes denied calls before the response reaches the agent.
 *
 * The proxy cannot stop a tool it does not execute, so blocking means the agent
 * never sees the call: the entry is dropped and, when a choice has nothing left to
 * run, its content becomes the denial text and the turn is finished. The agent
 * carries on with a normal assistant message instead of a silent no-op.
 */
export function stripDeniedToolCalls(
  rawResponse: unknown,
  denialsByCallId: ReadonlyMap<string, string>,
): unknown {
  if (denialsByCallId.size === 0 || !isRecord(rawResponse)) {
    return rawResponse;
  }

  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.choices)) {
    return rawResponse;
  }

  for (const choice of clone.choices) {
    if (!isRecord(choice) || !isRecord(choice.message)) {
      continue;
    }
    const message = choice.message;
    if (!Array.isArray(message.tool_calls)) {
      continue;
    }

    const removedReasons: string[] = [];
    const kept = message.tool_calls.filter((call) => {
      if (!isRecord(call) || typeof call.id !== 'string') {
        return true;
      }
      const reason = denialsByCallId.get(call.id);
      if (reason === undefined) {
        return true;
      }
      removedReasons.push(reason);
      return false;
    });

    if (removedReasons.length === 0) {
      continue;
    }

    if (kept.length > 0) {
      message.tool_calls = kept;
      continue;
    }

    delete message.tool_calls;
    const existing = typeof message.content === 'string' ? message.content : '';
    const denialText = removedReasons.join(' ');
    message.content = existing === '' ? denialText : `${existing}\n${denialText}`;
    choice.finish_reason = 'stop';
  }

  return clone;
}
