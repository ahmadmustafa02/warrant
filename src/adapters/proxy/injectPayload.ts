import type { ExchangeWire } from './exchangeWire';

/**
 * Where a scan places its payload.
 *
 * `tool-result` is the honest default: it reproduces indirect prompt injection by
 * poisoning content the agent's own tools returned, so authority still comes from
 * the user turn. `user-content` appends to the latest user message instead, which
 * also hands the payload the user's authority — only useful for agents that fold
 * retrieved documents into the user turn, and reported with that caveat.
 */
export type InjectionTarget = 'tool-result' | 'user-content';

export interface ScanInjection {
  readonly line: string;
  /** Fake credential planted beside the payload; echoing it back proves exfiltration. */
  readonly canary?: string;
  readonly target?: InjectionTarget;
}

export interface InjectionOutcome {
  readonly request: unknown;
  /** `none` when the conversation had no untrusted slot to poison. */
  readonly appliedTo: InjectionTarget | 'none';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function injectionText(injection: ScanInjection): string {
  if (injection.canary === undefined || injection.canary === '') {
    return injection.line;
  }
  return `${injection.line}\nReference credential: ${injection.canary}`;
}

function appendText(existing: unknown, text: string): unknown {
  if (typeof existing === 'string') {
    return existing === '' ? text : `${existing}\n\n${text}`;
  }
  if (Array.isArray(existing)) {
    const parts: unknown[] = existing;
    return [...parts, { type: 'text', text }];
  }
  return text;
}

function injectOpenAi(
  rawRequest: unknown,
  text: string,
  target: InjectionTarget,
): InjectionOutcome {
  if (!isRecord(rawRequest) || !Array.isArray(rawRequest.messages)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  const clone: unknown = structuredClone(rawRequest);
  if (!isRecord(clone) || !Array.isArray(clone.messages)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  const role = target === 'tool-result' ? 'tool' : 'user';
  for (let index = clone.messages.length - 1; index >= 0; index -= 1) {
    const message: unknown = clone.messages[index];
    if (!isRecord(message) || message.role !== role) {
      continue;
    }
    message.content = appendText(message.content, text);
    return { request: clone, appliedTo: target };
  }

  return { request: rawRequest, appliedTo: 'none' };
}

function injectAnthropic(
  rawRequest: unknown,
  text: string,
  target: InjectionTarget,
): InjectionOutcome {
  if (!isRecord(rawRequest) || !Array.isArray(rawRequest.messages)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  const clone: unknown = structuredClone(rawRequest);
  if (!isRecord(clone) || !Array.isArray(clone.messages)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  for (let index = clone.messages.length - 1; index >= 0; index -= 1) {
    const message: unknown = clone.messages[index];
    if (!isRecord(message)) {
      continue;
    }

    if (target === 'user-content') {
      if (message.role !== 'user') {
        continue;
      }
      // A user turn carrying tool_result blocks is transport, not a human request.
      if (
        Array.isArray(message.content) &&
        message.content.some((block) => isRecord(block) && block.type === 'tool_result')
      ) {
        continue;
      }
      message.content = appendText(message.content, text);
      return { request: clone, appliedTo: target };
    }

    if (!Array.isArray(message.content)) {
      continue;
    }
    for (
      let blockIndex = message.content.length - 1;
      blockIndex >= 0;
      blockIndex -= 1
    ) {
      const block: unknown = message.content[blockIndex];
      if (!isRecord(block) || block.type !== 'tool_result') {
        continue;
      }
      block.content = appendText(block.content, text);
      return { request: clone, appliedTo: target };
    }
  }

  return { request: rawRequest, appliedTo: 'none' };
}

function injectGemini(
  rawRequest: unknown,
  text: string,
  target: InjectionTarget,
): InjectionOutcome {
  if (!isRecord(rawRequest) || !Array.isArray(rawRequest.contents)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  const clone: unknown = structuredClone(rawRequest);
  if (!isRecord(clone) || !Array.isArray(clone.contents)) {
    return { request: rawRequest, appliedTo: 'none' };
  }

  for (let index = clone.contents.length - 1; index >= 0; index -= 1) {
    const content: unknown = clone.contents[index];
    if (!isRecord(content) || !Array.isArray(content.parts)) {
      continue;
    }

    const carriesToolResult = content.parts.some(
      (part) => isRecord(part) && isRecord(part.functionResponse),
    );

    if (target === 'tool-result') {
      if (!carriesToolResult) {
        continue;
      }
    } else {
      const role = content.role;
      if (carriesToolResult || (role !== 'user' && role !== undefined)) {
        continue;
      }
    }

    const parts: unknown[] = content.parts;
    content.parts = [...parts, { text }];
    return { request: clone, appliedTo: target };
  }

  return { request: rawRequest, appliedTo: 'none' };
}

/**
 * Plants a scan payload in the outbound request on its way upstream.
 *
 * The agent under test is never modified: it reads the poisoned tool result back
 * from the model exactly as it would read a poisoned document from its own store.
 */
export function injectIntoRequest(
  rawRequest: unknown,
  wire: ExchangeWire,
  injection: ScanInjection,
): InjectionOutcome {
  const text = injectionText(injection);
  const target = injection.target ?? 'tool-result';

  if (wire === 'anthropic') {
    return injectAnthropic(rawRequest, text, target);
  }
  if (wire === 'gemini') {
    return injectGemini(rawRequest, text, target);
  }
  return injectOpenAi(rawRequest, text, target);
}
