import type { ExchangeWire } from './exchangeWire';
import type { ObservedToolExchange } from '@/core/authorization/recipientOrigin';

/**
 * Prior tool calls already in this request, paired with the text they returned.
 *
 * The model proposes the next recipient as plain JSON. These observations are how
 * the guard tells a contacts lookup apart from an address that arrived inside a
 * document. Unpaired output is kept under an unknown tool name so it still counts
 * as content.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function pushResult(
  results: ObservedToolExchange[],
  toolName: string,
  argumentsText: string,
  output: unknown,
): void {
  results.push({
    toolName,
    argumentsText,
    outputText: asText(output),
  });
}

function observeOpenAi(body: unknown): readonly ObservedToolExchange[] {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return [];
  }
  const pending = new Map<string, { name: string; argumentsText: string }>();
  const results: ObservedToolExchange[] = [];
  for (const message of body.messages) {
    if (!isRecord(message)) {
      continue;
    }
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (
          !isRecord(call) ||
          typeof call.id !== 'string' ||
          !isRecord(call.function)
        ) {
          continue;
        }
        const name = call.function.name;
        const args = call.function.arguments;
        if (typeof name !== 'string') {
          continue;
        }
        pending.set(call.id, {
          name,
          argumentsText: typeof args === 'string' ? args : asText(args),
        });
      }
    }
    if (message.role === 'tool') {
      const id = typeof message.tool_call_id === 'string' ? message.tool_call_id : '';
      const call = pending.get(id);
      pushResult(
        results,
        call?.name ?? 'unknown',
        call?.argumentsText ?? '',
        message.content,
      );
    }
  }
  return results;
}

function observeResponses(body: unknown): readonly ObservedToolExchange[] {
  if (!isRecord(body) || !Array.isArray(body.input)) {
    return [];
  }
  const pending = new Map<string, { name: string; argumentsText: string }>();
  const results: ObservedToolExchange[] = [];
  for (const item of body.input) {
    if (!isRecord(item) || typeof item.type !== 'string') {
      continue;
    }
    if (item.type === 'function_call') {
      const id = typeof item.call_id === 'string' ? item.call_id : '';
      const name = typeof item.name === 'string' ? item.name : '';
      if (id === '' || name === '') {
        continue;
      }
      pending.set(id, {
        name,
        argumentsText:
          typeof item.arguments === 'string' ? item.arguments : asText(item.arguments),
      });
    }
    if (item.type === 'function_call_output') {
      const id = typeof item.call_id === 'string' ? item.call_id : '';
      const call = pending.get(id);
      pushResult(
        results,
        call?.name ?? 'unknown',
        call?.argumentsText ?? '',
        item.output,
      );
    }
  }
  return results;
}

function observeAnthropic(body: unknown): readonly ObservedToolExchange[] {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return [];
  }
  const pending = new Map<string, { name: string; argumentsText: string }>();
  const results: ObservedToolExchange[] = [];
  for (const message of body.messages) {
    if (!isRecord(message) || !Array.isArray(message.content)) {
      continue;
    }
    for (const block of message.content) {
      if (!isRecord(block) || typeof block.type !== 'string') {
        continue;
      }
      if (block.type === 'tool_use') {
        const id = typeof block.id === 'string' ? block.id : '';
        const name = typeof block.name === 'string' ? block.name : '';
        if (id === '' || name === '') {
          continue;
        }
        pending.set(id, { name, argumentsText: asText(block.input) });
      }
      if (block.type === 'tool_result') {
        const id = typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
        const call = pending.get(id);
        pushResult(
          results,
          call?.name ?? 'unknown',
          call?.argumentsText ?? '',
          block.content,
        );
      }
    }
  }
  return results;
}

function observeGemini(body: unknown): readonly ObservedToolExchange[] {
  if (!isRecord(body) || !Array.isArray(body.contents)) {
    return [];
  }
  const pending = new Map<string, string[]>();
  const results: ObservedToolExchange[] = [];
  for (const entry of body.contents) {
    if (!isRecord(entry) || !Array.isArray(entry.parts)) {
      continue;
    }
    for (const part of entry.parts) {
      if (!isRecord(part)) {
        continue;
      }
      if (isRecord(part.functionCall) && typeof part.functionCall.name === 'string') {
        const name = part.functionCall.name;
        const queue = pending.get(name) ?? [];
        queue.push(asText(part.functionCall.args));
        pending.set(name, queue);
      }
      if (
        isRecord(part.functionResponse) &&
        typeof part.functionResponse.name === 'string'
      ) {
        const name = part.functionResponse.name;
        const queue = pending.get(name) ?? [];
        const argumentsText = queue.shift() ?? '';
        pushResult(results, name, argumentsText, part.functionResponse.response);
      }
    }
  }
  return results;
}

export function observeToolResults(
  body: unknown,
  wire: ExchangeWire,
): readonly ObservedToolExchange[] {
  if (wire === 'openai') {
    return observeOpenAi(body);
  }
  if (wire === 'openai-responses') {
    return observeResponses(body);
  }
  if (wire === 'anthropic') {
    return observeAnthropic(body);
  }
  return observeGemini(body);
}
