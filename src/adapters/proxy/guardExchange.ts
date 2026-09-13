import { evaluateToolCall, type GuardMode } from '@/agent/guard/applyGuard';
import type { GuardDecision } from '@/core/authorization/decide';
import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import type { ToolDefinition } from '@/core/tools/registry';
import { driftedToolNames, type ToolDrift } from '@/core/tools/toolSetDrift';
import { buildProxyRegistry, type ToolOverride } from './classifyDiscoveredTool';
import type { ProxySession } from './proxySession';
import { deriveProxyIntent } from './deriveProxyIntent';
import { buildSecretTrackerFromOpenAiRequest } from './ingestOpenAiToolResults';
import {
  parseOpenAiRequest,
  parseOpenAiToolCalls,
  redactUnauthorizedSecretsInResponse,
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
    }
  | {
      readonly kind: 'DRIFT';
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
  /** Capabilities that changed after the session established its baseline. */
  readonly drifts: readonly ToolDrift[];
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
  drifts: Object.freeze([]),
} as const;

export function guardExchange(options: {
  readonly mode: GuardMode;
  readonly rawRequest: unknown;
  readonly rawResponse: unknown;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
  /** Supplies the per-run tool-set baseline; omitted when drift is not tracked. */
  readonly session?: ProxySession;
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

  // Observed on every exchange, not only those that propose calls, so a capability
  // advertised on a quiet turn is still measured against the original baseline.
  const drifts = options.session?.observeTools(request.tools) ?? [];
  const drifted = driftedToolNames(drifts);

  // The warrant is issued from the user turn only, before any tool result in this
  // exchange is considered, which is what makes later injected text unable to widen it.
  const intent = deriveProxyIntent(request.userRequest, registry);

  const withOutputRedaction = (body: unknown): unknown => {
    if (options.mode !== 'ENFORCE') {
      return body;
    }
    const secretTracker = buildSecretTrackerFromOpenAiRequest(
      options.rawRequest,
      registry,
    );
    return redactUnauthorizedSecretsInResponse(
      body,
      (text) =>
        secretTracker.redactUnauthorizedInText(text, intent.requestedTools).text,
    );
  };

  if (toolCalls.length === 0) {
    return {
      ...EMPTY_EXCHANGE,
      response: withOutputRedaction(options.rawResponse),
      classifiedTools,
      drifts: Object.freeze([...drifts]),
    };
  }
  const warrant = issueWarrant(taint(intent, 'USER'), registry);

  const decisions: ProxyDecision[] = [];
  const denialsByCallId = new Map<string, string>();
  const blockedTools: string[] = [];
  const wouldBlockTools: string[] = [];

  for (const call of toolCalls) {
    // Drift is checked before the warrant, and it overrides the read-only exemption.
    // A tool whose origin is suspect gets no benefit from its own risk tier, because
    // that tier was inferred from a name the injector chose.
    if (drifted.has(call.name)) {
      const drift = drifts.find((entry) => entry.toolName === call.name);
      const reason = `Warrant denied ${call.name}: ${drift?.reason ?? 'its advertised surface changed mid-session'}.`;
      decisions.push({
        kind: 'DRIFT',
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
    response: withOutputRedaction(
      stripDeniedToolCalls(options.rawResponse, denialsByCallId),
    ),
    decisions: Object.freeze(decisions),
    blockedTools: Object.freeze(blockedTools),
    wouldBlockTools: Object.freeze(wouldBlockTools),
    classifiedTools,
    authorizedTools: Object.freeze([...intent.requestedTools]),
    drifts: Object.freeze([...drifts]),
  };
}
