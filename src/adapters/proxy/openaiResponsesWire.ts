import { z } from 'zod';
import { isStoredContextPart } from '@/core/authorization/currentRequest';
import type { CanonicalRequest, CanonicalToolCall, DiscoveredTool } from './canonical';
import { redactArgumentJson } from './redactToolArguments';
import { readSchemaParameters } from './schemaParameters';
import { messageCarriesToolOutput } from './toolCarriedUserTurn';

/**
 * OpenAI Responses API (`POST /v1/responses`), the default transport of the
 * Vercel AI SDK's OpenAI provider. Conversation state arrives as `input` items and
 * tool calls leave as `function_call` output items keyed by `call_id` — the id the
 * agent echoes back in `function_call_output`, so denials are keyed on it too.
 */

const contentPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

const inputItemSchema = z.object({
  type: z.string().optional(),
  role: z.string().optional(),
  content: z.union([z.string(), z.array(contentPartSchema)]).optional(),
});

const toolSchema = z.object({
  type: z.string(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  parameters: z.unknown().optional(),
});

const responsesRequestSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(inputItemSchema)]),
  tools: z.array(toolSchema).optional(),
});

const functionCallItemSchema = z.object({
  type: z.literal('function_call'),
  call_id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});

const responsesResponseSchema = z.object({
  output: z.array(z.object({ type: z.string() }).passthrough()),
});

export class ResponsesWireParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResponsesWireParseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function partsText(content: z.infer<typeof inputItemSchema>['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  return (content ?? [])
    .filter((part) => !isStoredContextPart(part.type))
    .map((part) => part.text ?? '')
    .filter((text) => text !== '')
    .join('\n');
}

export function parseResponsesRequest(body: unknown): CanonicalRequest {
  const parsed = responsesRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponsesWireParseError('request is not an OpenAI Responses call');
  }

  let userRequest = '';
  if (typeof parsed.data.input === 'string') {
    userRequest = parsed.data.input;
  } else {
    let latest: (typeof parsed.data.input)[number] | undefined;
    for (let index = 0; index < parsed.data.input.length; index += 1) {
      const item = parsed.data.input[index];
      if (
        item === undefined ||
        item.role !== 'user' ||
        (item.type !== undefined && item.type !== 'message')
      ) {
        continue;
      }
      const previous = parsed.data.input[index - 1];
      const previousTurn =
        previous?.type === 'function_call'
          ? { role: 'assistant' as const, tool_calls: [{}] }
          : undefined;
      if (
        messageCarriesToolOutput({ role: 'user', content: item.content }, previousTurn)
      ) {
        continue;
      }
      latest = item;
    }
    userRequest = latest === undefined ? '' : partsText(latest.content);
  }

  // Built-in tools (web_search, file_search, …) run server-side at OpenAI; the proxy
  // only ever sees and judges client-executed function tools.
  const tools: DiscoveredTool[] = [];
  for (const tool of parsed.data.tools ?? []) {
    if (tool.type !== 'function' || tool.name === undefined || tool.name === '') {
      continue;
    }
    const schema = readSchemaParameters(tool.parameters);
    tools.push({
      name: tool.name,
      description: tool.description ?? '',
      parameterNames: schema.names,
      ...(Object.keys(schema.descriptions).length > 0
        ? { parameterDescriptions: schema.descriptions }
        : {}),
    });
  }

  return {
    model: parsed.data.model ?? 'unknown',
    userRequest,
    tools: Object.freeze(tools),
  };
}

export function parseResponsesToolCalls(body: unknown): readonly CanonicalToolCall[] {
  const parsed = responsesResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponsesWireParseError('response is not an OpenAI Responses object');
  }

  const calls: CanonicalToolCall[] = [];
  for (const item of parsed.data.output) {
    if (item.type !== 'function_call') {
      continue;
    }
    const call = functionCallItemSchema.safeParse(item);
    if (!call.success) {
      throw new ResponsesWireParseError('function_call item is malformed');
    }
    calls.push({
      id: call.data.call_id,
      name: call.data.name,
      rawArguments: call.data.arguments,
    });
  }
  return Object.freeze(calls);
}

function denialMessageItem(text: string): Record<string, unknown> {
  return {
    type: 'message',
    id: 'msg_warrant_denial',
    status: 'completed',
    role: 'assistant',
    content: [{ type: 'output_text', text, annotations: [] }],
  };
}

/**
 * Drops denied `function_call` items. When nothing callable is left, the denial
 * text becomes an assistant message so the agent ends the turn normally.
 */
export function stripDeniedResponsesFunctionCalls(
  rawResponse: unknown,
  denialsByCallId: ReadonlyMap<string, string>,
): unknown {
  if (denialsByCallId.size === 0 || !isRecord(rawResponse)) {
    return rawResponse;
  }
  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.output)) {
    return rawResponse;
  }

  const removedReasons: string[] = [];
  const items: unknown[] = clone.output;
  const kept = items.filter((item) => {
    if (
      !isRecord(item) ||
      item.type !== 'function_call' ||
      typeof item.call_id !== 'string'
    ) {
      return true;
    }
    const reason = denialsByCallId.get(item.call_id);
    if (reason === undefined) {
      return true;
    }
    removedReasons.push(reason);
    return false;
  });

  if (removedReasons.length === 0) {
    return rawResponse;
  }

  const stillCalls = kept.some(
    (item) => isRecord(item) && item.type === 'function_call',
  );
  clone.output = stillCalls
    ? kept
    : [...kept, denialMessageItem(removedReasons.join(' '))];
  return clone;
}

export function redactResponsesOutputText(
  rawResponse: unknown,
  redact: (text: string) => string,
): unknown {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse.output)) {
    return rawResponse;
  }
  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.output)) {
    return rawResponse;
  }
  for (const item of clone.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (
        isRecord(part) &&
        part.type === 'output_text' &&
        typeof part.text === 'string'
      ) {
        part.text = redact(part.text);
      }
    }
  }
  for (const item of clone.output) {
    if (
      isRecord(item) &&
      item.type === 'function_call' &&
      typeof item.arguments === 'string'
    ) {
      item.arguments = redactArgumentJson(item.arguments, redact);
    }
  }
  return clone;
}

/** Appends scan text to the latest tool output, or to the latest user message. */
export function injectIntoResponsesRequest(
  rawRequest: unknown,
  text: string,
  target: 'tool-result' | 'user-content',
): { readonly request: unknown; readonly applied: boolean } {
  if (!isRecord(rawRequest)) {
    return { request: rawRequest, applied: false };
  }
  const clone: unknown = structuredClone(rawRequest);
  if (!isRecord(clone)) {
    return { request: rawRequest, applied: false };
  }

  if (typeof clone.input === 'string') {
    if (target !== 'user-content') {
      return { request: rawRequest, applied: false };
    }
    clone.input = `${clone.input}\n\n${text}`;
    return { request: clone, applied: true };
  }
  if (!Array.isArray(clone.input)) {
    return { request: rawRequest, applied: false };
  }

  for (let index = clone.input.length - 1; index >= 0; index -= 1) {
    const item: unknown = clone.input[index];
    if (!isRecord(item)) {
      continue;
    }
    if (target === 'tool-result' && item.type === 'function_call_output') {
      const existing =
        typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
      item.output = existing === '' ? text : `${existing}\n\n${text}`;
      return { request: clone, applied: true };
    }
    if (
      target === 'user-content' &&
      item.role === 'user' &&
      (item.type === undefined || item.type === 'message')
    ) {
      if (typeof item.content === 'string') {
        item.content = `${item.content}\n\n${text}`;
      } else if (Array.isArray(item.content)) {
        const parts: unknown[] = item.content;
        item.content = [...parts, { type: 'input_text', text }];
      } else {
        continue;
      }
      return { request: clone, applied: true };
    }
  }
  return { request: rawRequest, applied: false };
}

/** Pulls the final response object out of a Responses SSE stream, if it completed. */
export function assembleResponsesFromSse(sseText: string): unknown {
  let completed: unknown = undefined;
  for (const line of sseText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(trimmed.slice('data:'.length).trim()) as unknown;
    } catch {
      continue;
    }
    if (
      isRecord(json) &&
      (json.type === 'response.completed' || json.type === 'response.incomplete') &&
      isRecord(json.response)
    ) {
      completed = json.response;
    }
  }
  if (completed === undefined) {
    throw new ResponsesWireParseError('stream ended without a completed response');
  }
  return completed;
}

/**
 * Re-emits a guarded response as a Responses event stream. Text and arguments go
 * out as single deltas: the guard already held the whole turn, so there is nothing
 * left to stream incrementally.
 */
export function responsesToSse(response: unknown): string {
  const events: string[] = [];
  let sequence = 0;
  const emit = (type: string, payload: Record<string, unknown>): void => {
    events.push(
      `event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: sequence, ...payload })}\n\n`,
    );
    sequence += 1;
  };

  const base = isRecord(response) ? response : {};
  const output: unknown[] = Array.isArray(base.output) ? base.output : [];
  emit('response.created', {
    response: { ...base, status: 'in_progress', output: [] },
  });

  output.forEach((item, outputIndex) => {
    if (!isRecord(item)) {
      return;
    }
    const itemId = typeof item.id === 'string' ? item.id : `item_${outputIndex}`;
    if (item.type === 'message' && Array.isArray(item.content)) {
      emit('response.output_item.added', {
        output_index: outputIndex,
        item: { ...item, id: itemId, status: 'in_progress', content: [] },
      });
      item.content.forEach((part, contentIndex) => {
        if (
          !isRecord(part) ||
          part.type !== 'output_text' ||
          typeof part.text !== 'string'
        ) {
          return;
        }
        emit('response.content_part.added', {
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          part: { ...part, text: '' },
        });
        emit('response.output_text.delta', {
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          delta: part.text,
          logprobs: [],
        });
        emit('response.output_text.done', {
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          text: part.text,
          logprobs: [],
        });
        emit('response.content_part.done', {
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          part,
        });
      });
    } else if (item.type === 'function_call') {
      const args = typeof item.arguments === 'string' ? item.arguments : '';
      emit('response.output_item.added', {
        output_index: outputIndex,
        item: { ...item, id: itemId, status: 'in_progress', arguments: '' },
      });
      emit('response.function_call_arguments.delta', {
        item_id: itemId,
        output_index: outputIndex,
        delta: args,
      });
      emit('response.function_call_arguments.done', {
        item_id: itemId,
        output_index: outputIndex,
        arguments: args,
      });
    } else {
      emit('response.output_item.added', { output_index: outputIndex, item });
    }
    emit('response.output_item.done', {
      output_index: outputIndex,
      item: { ...item, id: itemId },
    });
  });

  emit('response.completed', { response: base });
  return events.join('');
}
