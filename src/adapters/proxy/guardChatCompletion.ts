import type { GuardMode } from '@/agent/guard/applyGuard';
import { guardExchange, type ProxyExchange } from './guardExchange';
import type { ToolOverride } from './classifyDiscoveredTool';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Streaming bypasses synchronous tool-call inspection, so enforce mode rejects it. */
export function requestUsesStream(body: unknown): boolean {
  return isRecord(body) && body.stream === true;
}

/**
 * Forwards one chat completion and runs the guard on the model's tool proposals.
 *
 * The caller's API key travels in `upstreamHeaders`; this module never logs it.
 */
export async function guardChatCompletion(options: {
  readonly mode: GuardMode;
  readonly upstreamUrl: string;
  readonly upstreamHeaders: Readonly<Record<string, string>>;
  readonly requestBody: unknown;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
}): Promise<{
  readonly status: number;
  readonly body: unknown;
  readonly exchange: ProxyExchange;
}> {
  if (options.mode === 'ENFORCE' && requestUsesStream(options.requestBody)) {
    throw new UpstreamGuardError(
      'Warrant cannot guard streaming chat completions. Set stream: false or run with --detect-only.',
      400,
      { error: 'streaming_not_guarded' },
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
  let parsed: unknown;
  try {
    parsed = rawText === '' ? {} : JSON.parse(rawText);
  } catch {
    parsed = { raw: rawText };
  }

  if (!upstream.ok) {
    throw new UpstreamGuardError(
      `upstream returned HTTP ${upstream.status}`,
      upstream.status,
      parsed,
    );
  }

  const exchange = guardExchange({
    mode: options.mode,
    rawRequest: options.requestBody,
    rawResponse: parsed,
    overrides: options.overrides,
  });

  return { status: upstream.status, body: exchange.response, exchange };
}
