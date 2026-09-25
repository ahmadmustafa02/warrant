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
  injectIntoRequest,
  type InjectionTarget,
  type ScanInjection,
} from './injectPayload';
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
  /** Set by `warrant scan` only: plants a payload in outbound traffic. */
  readonly injection?: ScanInjection;
}): Promise<{
  readonly status: number;
  readonly body: unknown;
  readonly exchange: ProxyExchange;
  readonly sseBody?: string;
  readonly injectedInto: InjectionTarget | 'none';
  /** The model tried to hand the planted credential back — an attempt, guard aside. */
  readonly canaryLeaked: boolean;
  /** The credential survived the guard and reached the agent — an actual leak. */
  readonly canaryDelivered: boolean;
}> {
  const wire = detectExchangeWire(options.requestBody, options.httpPath ?? '');
  const usesStream = requestUsesStream(options.requestBody, wire);
  const streaming = options.streaming ?? 'guard';

  // The guard must judge the conversation the model actually saw, so every step
  // below reads the injected request rather than what the agent handed us.
  const injected =
    options.injection === undefined
      ? { request: options.requestBody, appliedTo: 'none' as const }
      : injectIntoRequest(options.requestBody, wire, options.injection);
  const requestBody = injected.request;

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
    body: JSON.stringify(requestBody),
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

  // Measured against the raw upstream reply, not the guarded one: a leak the guard
  // redacts on the way out is still an attempt the agent made.
  const canary = options.injection?.canary;
  const canaryLeaked =
    canary !== undefined && canary !== '' && JSON.stringify(parsed).includes(canary);

  const request = parseExchangeRequest(requestBody, wire);
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
    rawRequest: requestBody,
    rawResponse: parsed,
    overrides: options.overrides,
    session: options.session,
    wire,
    httpPath: options.httpPath,
    intent,
    approval: options.approval,
  });

  const canaryDelivered =
    canaryLeaked && JSON.stringify(exchange.response).includes(canary ?? '');

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
      injectedInto: injected.appliedTo,
      canaryLeaked,
      canaryDelivered,
    };
  }

  return {
    status: upstream.status,
    body: exchange.response,
    exchange,
    injectedInto: injected.appliedTo,
    canaryLeaked,
    canaryDelivered,
  };
}
