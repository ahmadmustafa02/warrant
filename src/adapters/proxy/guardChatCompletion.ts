import { resolveProxyIntent } from '@/agent/intent/resolveProxyIntent';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { IntentParseMode } from '@/agent/intent/parseUserIntentLlm';
import { buildProxyRegistry, type ToolOverride } from './classifyDiscoveredTool';
import {
  detectExchangeWire,
  parseExchangeRequest,
  requestUsesStream,
} from './exchangeWire';
import { guardExchangeAsync, type ProxyExchange } from './guardExchange';
import {
  assembleOpenAiCompletionFromSse,
  chatCompletionToOpenAiSse,
  openAiCompletionToChatResponse,
} from './openAiStreamGuard';
import type { ApprovalCoordinator } from './proxyApproval';
import type { ProxySession } from './proxySession';
import type { StreamingPolicy } from './proxyPolicy';

export class UpstreamGuardError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(message);
    this.name = 'UpstreamGuardError';
  }
}

function upstreamResponseLooksLikeSse(
  contentType: string | null,
  rawText: string,
): boolean {
  if (contentType?.includes('text/event-stream') === true) {
    return true;
  }
  return rawText.trimStart().startsWith('data:');
}

/**
 * Forwards one model call and runs the guard on the model's tool proposals.
 *
 * The caller's API key travels in `upstreamHeaders`; this module never logs it.
 */
export async function guardChatCompletion(options: {
  readonly mode: GuardMode;
  readonly upstreamUrl: string;
  readonly upstreamHeaders: Readonly<Record<string, string>>;
  readonly requestBody: unknown;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
  readonly session?: ProxySession;
  readonly httpPath?: string;
  readonly intentMode?: IntentParseMode;
  readonly destructiveRequiresExplicitUser?: boolean;
  readonly streaming?: StreamingPolicy;
  readonly approval?: ApprovalCoordinator;
}): Promise<{
  readonly status: number;
  readonly body: unknown;
  readonly exchange: ProxyExchange;
  readonly sseBody?: string;
}> {
  const wire = detectExchangeWire(options.requestBody, options.httpPath ?? '');
  const usesStream = requestUsesStream(options.requestBody, wire);
  const streaming = options.streaming ?? 'guard';

  if (options.mode === 'ENFORCE' && usesStream && streaming === 'block') {
    throw new UpstreamGuardError(
      'Warrant blocks streaming in ENFORCE when proxy-policy streaming is "block". Set streaming to "guard" or use --detect-only.',
      400,
      { error: 'streaming_blocked' },
    );
  }

  const upstream = await fetch(options.upstreamUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...options.upstreamHeaders,
    },
    body: JSON.stringify(options.requestBody),
  });

  const rawText = await upstream.text();
  const contentType = upstream.headers.get('content-type');

  let parsed: unknown;
  if (wire === 'openai' && upstreamResponseLooksLikeSse(contentType, rawText)) {
    const assembled = assembleOpenAiCompletionFromSse(rawText);
    parsed = openAiCompletionToChatResponse(assembled);
  } else {
    try {
      parsed = rawText === '' ? {} : JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }
  }

  if (!upstream.ok) {
    throw new UpstreamGuardError(
      `upstream returned HTTP ${upstream.status}`,
      upstream.status,
      parsed,
    );
  }

  const request = parseExchangeRequest(options.requestBody, wire);
  const registry = buildProxyRegistry(request.tools, options.overrides ?? {});
  const intentMode = options.intentMode ?? 'heuristic';
  const intent = await resolveProxyIntent({
    mode: intentMode,
    userRequest: request.userRequest,
    registry,
    destructiveRequiresExplicitUser: options.destructiveRequiresExplicitUser ?? true,
  });

  const exchange = await guardExchangeAsync({
    mode: options.mode,
    rawRequest: options.requestBody,
    rawResponse: parsed,
    overrides: options.overrides,
    session: options.session,
    wire,
    httpPath: options.httpPath,
    intent,
    approval: options.approval,
  });

  const respondAsSse =
    usesStream &&
    streaming === 'guard' &&
    wire === 'openai' &&
    options.mode === 'ENFORCE';

  if (respondAsSse) {
    return {
      status: upstream.status,
      body: exchange.response,
      exchange,
      sseBody: chatCompletionToOpenAiSse(exchange.response),
    };
  }

  return { status: upstream.status, body: exchange.response, exchange };
}
