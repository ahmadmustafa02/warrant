import type { CanonicalRequest, CanonicalToolCall } from './canonical';
import {
  AnthropicWireParseError,
  parseAnthropicRequest,
  parseAnthropicToolCalls,
  redactAnthropicTextBlocks,
  stripDeniedAnthropicToolUses,
} from './anthropicWire';
import {
  GeminiWireParseError,
  parseGeminiRequest,
  parseGeminiToolCalls,
  redactGeminiTextParts,
  stripDeniedGeminiFunctionCalls,
} from './geminiWire';
import {
  parseOpenAiRequest,
  parseOpenAiToolCalls,
  redactUnauthorizedSecretsInResponse,
  stripDeniedToolCalls,
  WireParseError,
} from './openaiWire';

export type ExchangeWire = 'openai' | 'anthropic' | 'gemini';

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
  if (httpPath.includes('generateContent')) {
    return 'gemini';
  }
  if (httpPath.endsWith('/messages') || httpPath === '/v1/messages') {
    return 'anthropic';
  }
  if (httpPath.endsWith('/chat/completions') || httpPath === '/v1/chat/completions') {
    return 'openai';
  }
  const parsed =
    typeof rawRequest === 'object' && rawRequest !== null ? rawRequest : {};
  if (
    'contents' in parsed &&
    Array.isArray((parsed as { contents?: unknown }).contents)
  ) {
    return 'gemini';
  }
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
    if (wire === 'anthropic') {
      return parseAnthropicRequest(rawRequest);
    }
    if (wire === 'gemini') {
      return parseGeminiRequest(rawRequest);
    }
    return parseOpenAiRequest(rawRequest);
  } catch (error) {
    const detail =
      error instanceof WireParseError ||
      error instanceof AnthropicWireParseError ||
      error instanceof GeminiWireParseError
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
    if (wire === 'anthropic') {
      return parseAnthropicToolCalls(rawResponse);
    }
    if (wire === 'gemini') {
      return parseGeminiToolCalls(rawResponse);
    }
    return parseOpenAiToolCalls(rawResponse);
  } catch (error) {
    const detail =
      error instanceof WireParseError ||
      error instanceof AnthropicWireParseError ||
      error instanceof GeminiWireParseError
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
  let stripped = options.rawResponse;
  if (options.wire === 'anthropic') {
    stripped = stripDeniedAnthropicToolUses(stripped, options.denialsByCallId);
    return redactAnthropicTextBlocks(stripped, options.redactText);
  }
  if (options.wire === 'gemini') {
    stripped = stripDeniedGeminiFunctionCalls(stripped, options.denialsByCallId);
    return redactGeminiTextParts(stripped, options.redactText);
  }
  stripped = stripDeniedToolCalls(stripped, options.denialsByCallId);
  return redactUnauthorizedSecretsInResponse(stripped, options.redactText);
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
