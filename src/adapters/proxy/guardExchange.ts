import { evaluateToolCall, type GuardMode } from '@/agent/guard/applyGuard';
import type { GuardDecision } from '@/core/authorization/decide';
import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import type { ToolDefinition } from '@/core/tools/registry';
import { buildProxyRegistry, type ToolOverride } from './classifyDiscoveredTool';
import { deriveProxyIntent } from './deriveProxyIntent';
import {
  parseOpenAiRequest,
  parseOpenAiToolCalls,
  stripDeniedToolCalls,
  WireParseError,
} from './openaiWire';

/**
 * A call the guard could not evaluate is tracked separately from one it judged.
 *
 * Malformed arguments never reach `decideToolCall`, so there is no `GuardDecision`
 * to report. Inventing a core denial code for a transport-level failure would put
 * protocol concerns inside `src/core/`, so the distinction lives here instead.
 */
export type ProxyDecision =
  | {
      readonly kind: 'GUARD';
      readonly callId: string;
      readonly decision: GuardDecision;
    }
  | {
      readonly kind: 'MALFORMED';
      readonly callId: string;
      readonly toolName: string;
      readonly reason: string;
    };

export interface ProxyExchange {
  /** Forwarded verbatim when nothing was denied, rewritten when calls were stripped. */
  readonly response: unknown;
  readonly decisions: readonly ProxyDecision[];
  /** Tools actually stopped — populated in ENFORCE only. */
  readonly blockedTools: readonly string[];
  /** Tools that would have been stopped — populated in DETECT_ONLY only. */
  readonly wouldBlockTools: readonly string[];
  /** Tiers assigned to observed tools, so the CLI can show what it inferred. */
  readonly classifiedTools: readonly ToolDefinition[];
  readonly authorizedTools: readonly string[];
}

/**
 * Raised when the guard cannot see what it is meant to guard.
 *
 * In ENFORCE the proxy must fail closed: forwarding a response it could not parse
 * would leave the caller believing they are protected while every tool call passes
 * unchecked. A silently disabled guard is the worst failure mode this project has,
 * so it is an error rather than a warning.
 */
export class ProxyGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyGuardError';
  }
}

const EMPTY_EXCHANGE = {
  decisions: Object.freeze([]),
  blockedTools: Object.freeze([]),
  wouldBlockTools: Object.freeze([]),
  classifiedTools: Object.freeze([]),
  authorizedTools: Object.freeze([]),
} as const;

export function guardExchange(options: {
  readonly mode: GuardMode;
  readonly rawRequest: unknown;
  readonly rawResponse: unknown;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
}): ProxyExchange {
  if (options.mode === 'OFF') {
    return { ...EMPTY_EXCHANGE, response: options.rawResponse };
  }

  let request;
  let toolCalls;
  try {
    request = parseOpenAiRequest(options.rawRequest);
    toolCalls = parseOpenAiToolCalls(options.rawResponse);
  } catch (error) {
    if (options.mode === 'ENFORCE') {
      const detail = error instanceof WireParseError ? error.message : 'unknown shape';
      throw new ProxyGuardError(
        `refusing to forward an unguarded exchange: ${detail}. Set mode SHADOW to observe traffic the guard cannot read.`,
      );
    }
    return { ...EMPTY_EXCHANGE, response: options.rawResponse };
  }

  const registry = buildProxyRegistry(request.tools, options.overrides ?? {});
  const classifiedTools = registry.list();

  if (toolCalls.length === 0) {
    return {
      ...EMPTY_EXCHANGE,
      response: options.rawResponse,
      classifiedTools,
    };
  }

  // The warrant is issued from the user turn only, before any tool result in this
  // exchange is considered, which is what makes later injected text unable to widen it.
  const intent = deriveProxyIntent(request.userRequest, registry);
  const warrant = issueWarrant(taint(intent, 'USER'), registry);

  const decisions: ProxyDecision[] = [];
  const denialsByCallId = new Map<string, string>();
  const blockedTools: string[] = [];
  const wouldBlockTools: string[] = [];

  for (const call of toolCalls) {
    let decision: GuardDecision | null;
    try {
      decision = evaluateToolCall({
        mode: options.mode,
        warrant,
        registry,
        toolName: call.name,
        rawArguments: call.rawArguments,
      });
    } catch {
      const reason = `Warrant blocked ${call.name}: its arguments were not valid JSON, so they could not be checked.`;
      decisions.push({
        kind: 'MALFORMED',
        callId: call.id,
        toolName: call.name,
        reason,
      });
      if (options.mode === 'ENFORCE') {
        denialsByCallId.set(call.id, reason);
        blockedTools.push(call.name);
      } else {
        wouldBlockTools.push(call.name);
      }
      continue;
    }

    if (decision === null) {
      continue;
    }

    decisions.push({ kind: 'GUARD', callId: call.id, decision });
    if (decision.allowed) {
      continue;
    }

    if (options.mode === 'ENFORCE') {
      denialsByCallId.set(
        call.id,
        `Warrant denied ${decision.tool} (${decision.code}): ${decision.reason}`,
      );
      blockedTools.push(decision.tool);
    } else {
      wouldBlockTools.push(decision.tool);
    }
  }

  return {
    response: stripDeniedToolCalls(options.rawResponse, denialsByCallId),
    decisions: Object.freeze(decisions),
    blockedTools: Object.freeze(blockedTools),
    wouldBlockTools: Object.freeze(wouldBlockTools),
    classifiedTools,
    authorizedTools: Object.freeze([...intent.requestedTools]),
  };
}
