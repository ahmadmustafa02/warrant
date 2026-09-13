import type { CanonicalRequest, CanonicalToolCall } from './canonical';
import {
  AnthropicWireParseError,
  parseAnthropicRequest,
  parseAnthropicToolCalls,
  redactAnthropicTextBlocks,
  stripDeniedAnthropicToolUses,
} from './anthropicWire';
import {
  parseOpenAiRequest,
  parseOpenAiToolCalls,
  redactUnauthorizedSecretsInResponse,
  stripDeniedToolCalls,
  WireParseError,
} from './openaiWire';

export type ExchangeWire = 'openai' | 'anthropic';

export class ExchangeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExchangeParseError';
  }
}

export function detectExchangeWire(
  rawRequest: unknown,
  httpPath: string,
): ExchangeWire {
  if (httpPath.endsWith('/messages') || httpPath === '/v1/messages') {
    return 'anthropic';
  }
  if (httpPath.endsWith('/chat/completions') || httpPath === '/v1/chat/completions') {
    return 'openai';
  }
  const parsed =
    typeof rawRequest === 'object' && rawRequest !== null ? rawRequest : {};
  if ('max_tokens' in parsed && !('stream' in parsed)) {
    return 'anthropic';
  }
  return 'openai';
}

export function parseExchangeRequest(
  rawRequest: unknown,
  wire: ExchangeWire,
): CanonicalRequest {
  try {
    return wire === 'anthropic'
      ? parseAnthropicRequest(rawRequest)
      : parseOpenAiRequest(rawRequest);
  } catch (error) {
    const detail =
      error instanceof WireParseError || error instanceof AnthropicWireParseError
        ? error.message
        : 'unknown shape';
    throw new ExchangeParseError(detail);
  }
}

export function parseExchangeToolCalls(
  rawResponse: unknown,
  wire: ExchangeWire,
): readonly CanonicalToolCall[] {
  try {
    return wire === 'anthropic'
      ? parseAnthropicToolCalls(rawResponse)
      : parseOpenAiToolCalls(rawResponse);
  } catch (error) {
    const detail =
      error instanceof WireParseError || error instanceof AnthropicWireParseError
        ? error.message
        : 'unknown shape';
    throw new ExchangeParseError(detail);
  }
}

export function rewriteExchangeResponse(options: {
  readonly wire: ExchangeWire;
  readonly rawResponse: unknown;
  readonly denialsByCallId: ReadonlyMap<string, string>;
  readonly redactText: (text: string) => string;
}): unknown {
  const stripped =
    options.wire === 'anthropic'
      ? stripDeniedAnthropicToolUses(options.rawResponse, options.denialsByCallId)
      : stripDeniedToolCalls(options.rawResponse, options.denialsByCallId);

  return options.wire === 'anthropic'
    ? redactAnthropicTextBlocks(stripped, options.redactText)
    : redactUnauthorizedSecretsInResponse(stripped, options.redactText);
}

export function requestUsesStream(rawRequest: unknown, wire: ExchangeWire): boolean {
  if (typeof rawRequest !== 'object' || rawRequest === null) {
    return false;
  }
  if ('stream' in rawRequest && rawRequest.stream === true) {
    return true;
  }
  return wire === 'anthropic' && 'stream' in rawRequest && rawRequest.stream === true;
}
