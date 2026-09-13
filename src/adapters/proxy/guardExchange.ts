import { evaluateToolCall, type GuardMode } from '@/agent/guard/applyGuard';
import type { GuardDecision } from '@/core/authorization/decide';
import { issueWarrant } from '@/core/authorization/warrant';
import type { UserIntent } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolDefinition } from '@/core/tools/registry';
import { driftedToolNames, type ToolDrift } from '@/core/tools/toolSetDrift';
import { buildProxyRegistry, type ToolOverride } from './classifyDiscoveredTool';
import { deriveProxyIntent } from './deriveProxyIntent';
import {
  detectExchangeWire,
  ExchangeParseError,
  parseExchangeRequest,
  parseExchangeToolCalls,
  rewriteExchangeResponse,
  type ExchangeWire,
} from './exchangeWire';
import { appendAnthropicToolSecretsToTracker } from './ingestAnthropicToolResults';
import { appendOpenAiToolSecretsToTracker } from './ingestOpenAiToolResults';
import type { ProxySession } from './proxySession';
import {
  augmentIntentWithTool,
  isApprovalEligible,
  type ApprovalCoordinator,
} from './proxyApproval';

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
  readonly session?: ProxySession;
  readonly wire?: ExchangeWire;
  readonly httpPath?: string;
  /** When omitted, the heuristic parser runs (tests and legacy callers). */
  readonly intent?: UserIntent;
}): ProxyExchange {
  if (options.mode === 'OFF') {
    return { ...EMPTY_EXCHANGE, response: options.rawResponse };
  }

  const wire =
    options.wire ?? detectExchangeWire(options.rawRequest, options.httpPath ?? '');

  let request;
  let toolCalls;
  try {
    request = parseExchangeRequest(options.rawRequest, wire);
    toolCalls = parseExchangeToolCalls(options.rawResponse, wire);
  } catch (error) {
    if (options.mode === 'ENFORCE') {
      const detail =
        error instanceof ExchangeParseError ? error.message : 'unknown shape';
      throw new ProxyGuardError(
        `refusing to forward an unguarded exchange: ${detail}. Set mode SHADOW to observe traffic the guard cannot read.`,
      );
    }
    return { ...EMPTY_EXCHANGE, response: options.rawResponse };
  }

  const registry = buildProxyRegistry(request.tools, options.overrides ?? {});
  const classifiedTools = registry.list();

  const drifts = options.session?.observeTools(request.tools) ?? [];
  const drifted = driftedToolNames(drifts);

  const intent = options.intent ?? deriveProxyIntent(request.userRequest, registry);

  const finalizeResponse = (denials: ReadonlyMap<string, string>): unknown => {
    if (options.mode !== 'ENFORCE') {
      return options.rawResponse;
    }
    const tracker = options.session?.secretTracker ?? new TurnSecretTracker();
    if (options.session !== undefined && wire === 'openai') {
      options.session.ingestOpenAiRequestSecrets(options.rawRequest, registry);
    } else if (wire === 'openai') {
      appendOpenAiToolSecretsToTracker(tracker, options.rawRequest, registry);
    } else if (options.session !== undefined && wire === 'anthropic') {
      options.session.ingestAnthropicRequestSecrets(options.rawRequest, registry);
    } else if (wire === 'anthropic') {
      appendAnthropicToolSecretsToTracker(tracker, options.rawRequest, registry);
    }
    return rewriteExchangeResponse({
      wire,
      rawResponse: options.rawResponse,
      denialsByCallId: denials,
      redactText: (text) =>
        tracker.redactUnauthorizedInText(text, intent.requestedTools).text,
    });
  };

  if (toolCalls.length === 0) {
    return {
      ...EMPTY_EXCHANGE,
      response: finalizeResponse(new Map()),
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
    response: finalizeResponse(denialsByCallId),
    decisions: Object.freeze(decisions),
    blockedTools: Object.freeze(blockedTools),
    wouldBlockTools: Object.freeze(wouldBlockTools),
    classifiedTools,
    authorizedTools: Object.freeze([...intent.requestedTools]),
    drifts: Object.freeze([...drifts]),
  };
}

/** Same as `guardExchange`, but may pause for interactive approval on eligible denials. */
export async function guardExchangeAsync(options: {
  readonly mode: GuardMode;
  readonly rawRequest: unknown;
  readonly rawResponse: unknown;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
  readonly session?: ProxySession;
  readonly wire?: ExchangeWire;
  readonly httpPath?: string;
  readonly intent?: UserIntent;
  readonly approval?: ApprovalCoordinator;
}): Promise<ProxyExchange> {
  if (options.mode !== 'ENFORCE' || options.approval === undefined) {
    return guardExchange(options);
  }

  const wire =
    options.wire ?? detectExchangeWire(options.rawRequest, options.httpPath ?? '');

  let request;
  let toolCalls;
  try {
    request = parseExchangeRequest(options.rawRequest, wire);
    toolCalls = parseExchangeToolCalls(options.rawResponse, wire);
  } catch (error) {
    const detail =
      error instanceof ExchangeParseError ? error.message : 'unknown shape';
    throw new ProxyGuardError(
      `refusing to forward an unguarded exchange: ${detail}. Set mode SHADOW to observe traffic the guard cannot read.`,
    );
  }

  const registry = buildProxyRegistry(request.tools, options.overrides ?? {});
  const classifiedTools = registry.list();
  const drifts = options.session?.observeTools(request.tools) ?? [];
  const drifted = driftedToolNames(drifts);

  let intent = options.intent ?? deriveProxyIntent(request.userRequest, registry);

  const buildFinalize =
    (activeIntent: UserIntent) =>
    (denials: ReadonlyMap<string, string>): unknown => {
      const tracker = options.session?.secretTracker ?? new TurnSecretTracker();
      if (options.session !== undefined && wire === 'openai') {
        options.session.ingestOpenAiRequestSecrets(options.rawRequest, registry);
      } else if (wire === 'openai') {
        appendOpenAiToolSecretsToTracker(tracker, options.rawRequest, registry);
      } else if (options.session !== undefined && wire === 'anthropic') {
        options.session.ingestAnthropicRequestSecrets(options.rawRequest, registry);
      } else if (wire === 'anthropic') {
        appendAnthropicToolSecretsToTracker(tracker, options.rawRequest, registry);
      }
      return rewriteExchangeResponse({
        wire,
        rawResponse: options.rawResponse,
        denialsByCallId: denials,
        redactText: (text) =>
          tracker.redactUnauthorizedInText(text, activeIntent.requestedTools).text,
      });
    };

  if (toolCalls.length === 0) {
    return {
      ...EMPTY_EXCHANGE,
      response: buildFinalize(intent)(new Map()),
      classifiedTools,
      drifts: Object.freeze([...drifts]),
    };
  }

  let warrant = issueWarrant(taint(intent, 'USER'), registry);
  const decisions: ProxyDecision[] = [];
  const denialsByCallId = new Map<string, string>();
  const blockedTools: string[] = [];

  for (const call of toolCalls) {
    if (drifted.has(call.name)) {
      const drift = drifts.find((entry) => entry.toolName === call.name);
      const reason = `Warrant denied ${call.name}: ${drift?.reason ?? 'its advertised surface changed mid-session'}.`;
      decisions.push({
        kind: 'DRIFT',
        callId: call.id,
        toolName: call.name,
        reason,
      });
      denialsByCallId.set(call.id, reason);
      blockedTools.push(call.name);
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
      denialsByCallId.set(call.id, reason);
      blockedTools.push(call.name);
      continue;
    }

    if (decision === null) {
      continue;
    }

    if (!decision.allowed && isApprovalEligible(decision)) {
      const choice = await options.approval.request({
        toolName: decision.tool,
        rawArguments: call.rawArguments,
        code: decision.code,
        reason: decision.reason,
        riskTier: decision.riskTier ?? 'SENSITIVE',
      });
      if (choice === 'approve') {
        intent = augmentIntentWithTool(intent, decision.tool);
        warrant = issueWarrant(taint(intent, 'USER'), registry);
        decision =
          evaluateToolCall({
            mode: options.mode,
            warrant,
            registry,
            toolName: call.name,
            rawArguments: call.rawArguments,
          }) ?? decision;
      }
    }

    if (decision === null) {
      continue;
    }

    decisions.push({ kind: 'GUARD', callId: call.id, decision });
    if (decision.allowed) {
      continue;
    }

    denialsByCallId.set(
      call.id,
      `Warrant denied ${decision.tool} (${decision.code}): ${decision.reason}`,
    );
    blockedTools.push(decision.tool);
  }

  return {
    response: buildFinalize(intent)(denialsByCallId),
    decisions: Object.freeze(decisions),
    blockedTools: Object.freeze(blockedTools),
    wouldBlockTools: Object.freeze([]),
    classifiedTools,
    authorizedTools: Object.freeze([...intent.requestedTools]),
    drifts: Object.freeze([...drifts]),
  };
}
