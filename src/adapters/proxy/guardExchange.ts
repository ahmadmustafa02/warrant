import {
  evaluateToolCall,
  parseToolArguments,
  type GuardMode,
} from '@/agent/guard/applyGuard';
import type { GuardDecision } from '@/core/authorization/decide';
import {
  destinationOriginsForCall,
  isEmailAuthorityParameter,
  type DestinationOrigin,
  type ObservedToolExchange,
} from '@/core/authorization/recipientOrigin';
import { findGrant, issueWarrant } from '@/core/authorization/warrant';
import type { UserIntent } from '@/core/authorization/warrant';
import { describeValue, taint } from '@/core/provenance/tainted';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolDefinition, ToolRegistry } from '@/core/tools/registry';
import { driftedToolNames, type ToolDrift } from '@/core/tools/toolSetDrift';
import { blockingDrifts } from './harmlessDrift';
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
import { appendGeminiToolSecretsToTracker } from './ingestGeminiToolResults';
import { appendOpenAiToolSecretsToTracker } from './ingestOpenAiToolResults';
import { appendResponsesToolSecretsToTracker } from './ingestResponsesToolResults';
import type { ProxySession } from './proxySession';
import { observeToolResults } from './observeToolResults';
import {
  augmentIntentWithTool,
  isApprovalEligible,
  pinApprovedDestination,
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
function originsForCall(
  warrant: ReturnType<typeof issueWarrant>,
  registry: ToolRegistry,
  toolName: string,
  rawArguments: string,
  observations: readonly ObservedToolExchange[],
): Readonly<Record<string, DestinationOrigin>> {
  try {
    const definition = registry.get(toolName);
    const grant = findGrant(warrant, toolName);
    return destinationOriginsForCall({
      authorityParameters: definition?.authorityParameters ?? [],
      args: parseToolArguments(rawArguments),
      namedParties: grant?.namedParties ?? {},
      observations,
    });
  } catch {
    return {};
  }
}

function intentAfterApproval(
  intent: UserIntent,
  decision: GuardDecision,
  rawArguments: string,
  registry: ToolRegistry,
): UserIntent {
  if (decision.allowed) {
    return intent;
  }
  const withTool = augmentIntentWithTool(intent, decision.tool);
  if (decision.code !== 'DESTINATION_ORIGIN_UNCLEAR') {
    return withTool;
  }
  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(rawArguments);
  } catch {
    return withTool;
  }
  const definition = registry.get(decision.tool);
  let next = withTool;
  for (const parameter of definition?.authorityParameters ?? []) {
    if (!isEmailAuthorityParameter(parameter) || !(parameter in args)) {
      continue;
    }
    next = pinApprovedDestination(
      next,
      decision.tool,
      parameter,
      describeValue(args[parameter]),
    );
  }
  return next;
}

function trackRequestSecrets(
  wire: ExchangeWire,
  rawRequest: unknown,
  registry: ToolRegistry,
  session: ProxySession | undefined,
  tracker: TurnSecretTracker,
): void {
  if (wire === 'openai') {
    if (session !== undefined) {
      session.ingestOpenAiRequestSecrets(rawRequest, registry);
      return;
    }
    appendOpenAiToolSecretsToTracker(tracker, rawRequest, registry);
    return;
  }
  if (wire === 'openai-responses') {
    if (session !== undefined) {
      session.ingestResponsesRequestSecrets(rawRequest, registry);
      return;
    }
    appendResponsesToolSecretsToTracker(tracker, rawRequest, registry);
    return;
  }
  if (wire === 'anthropic') {
    if (session !== undefined) {
      session.ingestAnthropicRequestSecrets(rawRequest, registry);
      return;
    }
    appendAnthropicToolSecretsToTracker(tracker, rawRequest, registry);
    return;
  }
  if (wire === 'gemini') {
    if (session !== undefined) {
      session.ingestGeminiRequestSecrets(rawRequest, registry);
      return;
    }
    appendGeminiToolSecretsToTracker(tracker, rawRequest, registry);
  }
}

const LINK_PARAMETER =
  /^(url|uri|endpoint|href|link|host|hostname|webhook|callback|src)$|(?:_url|_uri|_href|_link)$/i;

function isSecretCarryingLink(parameter: string, value: string): boolean {
  if (LINK_PARAMETER.test(parameter)) {
    return true;
  }
  return /^https?:\/\//i.test(value.trim());
}

/**
 * A destination that contains a secret is stopped, not edited. Replacing the
 * secret inside the URL would still send the request to the attacker's host.
 * An address the user typed themselves is left to the pin.
 */
function denySecretLink(
  call: { readonly name: string; readonly rawArguments: string },
  decision: GuardDecision,
  tracker: TurnSecretTracker,
  authorizedTools: readonly string[],
  warrant: ReturnType<typeof issueWarrant>,
): GuardDecision {
  if (!decision.allowed) {
    return decision;
  }
  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(call.rawArguments);
  } catch {
    return decision;
  }
  const grant = findGrant(warrant, call.name);
  for (const [parameter, value] of Object.entries(args)) {
    if (typeof value !== 'string' || !isSecretCarryingLink(parameter, value)) {
      continue;
    }
    if (grant?.pinnedParameters[parameter] === value) {
      continue;
    }
    if (!tracker.containsUnauthorizedSecret(value, authorizedTools)) {
      continue;
    }
    return {
      allowed: false,
      tool: call.name,
      riskTier: decision.riskTier,
      code: 'SECRET_IN_LINK',
      taintSources: decision.taintSources,
      reason: `${parameter} carries a secret from a tool this turn did not authorize, so the link is stopped`,
    };
  }
  return decision;
}

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

  const drifts = blockingDrifts(
    options.session,
    options.session?.observeTools(request.tools) ?? [],
    request.tools,
  );
  const drifted = driftedToolNames(drifts);

  const intent = options.intent ?? deriveProxyIntent(request.userRequest, registry);
  const secretTracker = options.session?.secretTracker ?? new TurnSecretTracker();
  trackRequestSecrets(
    wire,
    options.rawRequest,
    registry,
    options.session,
    secretTracker,
  );

  const finalizeResponse = (denials: ReadonlyMap<string, string>): unknown => {
    if (options.mode !== 'ENFORCE') {
      return options.rawResponse;
    }
    return rewriteExchangeResponse({
      wire,
      rawResponse: options.rawResponse,
      denialsByCallId: denials,
      redactText: (text) =>
        secretTracker.redactUnauthorizedInText(text, intent.requestedTools).text,
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

  const observations = observeToolResults(options.rawRequest, wire);
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
        destinationOrigins: originsForCall(
          warrant,
          registry,
          call.name,
          call.rawArguments,
          observations,
        ),
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

    decision = denySecretLink(
      call,
      decision,
      secretTracker,
      intent.requestedTools,
      warrant,
    );

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

/**
 * A person may accept a new or changed tool into the saved pin.
 *
 * The call is then judged like any other call. Accepting the tool does not
 * accept a document-chosen recipient or a link that carries a secret.
 */
async function acceptDriftedTool(
  options: {
    readonly approval?: ApprovalCoordinator;
    readonly session?: ProxySession;
  },
  tools: readonly {
    readonly name: string;
    readonly parameterNames: readonly string[];
  }[],
  toolName: string,
  rawArguments: string,
  reason: string,
): Promise<boolean> {
  if (options.approval === undefined || options.session === undefined) {
    return false;
  }
  const choice = await options.approval.request({
    toolName,
    rawArguments,
    code: 'TOOL_SET_DRIFT',
    reason,
    riskTier: 'SENSITIVE',
  });
  if (choice !== 'approve') {
    return false;
  }
  const advertised = tools.find((tool) => tool.name === toolName);
  options.session.acceptTool({
    name: toolName,
    parameterNames: advertised?.parameterNames ?? [],
  });
  return true;
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
  const drifts = blockingDrifts(
    options.session,
    options.session?.observeTools(request.tools) ?? [],
    request.tools,
  );
  const drifted = driftedToolNames(drifts);

  let intent = options.intent ?? deriveProxyIntent(request.userRequest, registry);
  const secretTracker = options.session?.secretTracker ?? new TurnSecretTracker();
  trackRequestSecrets(
    wire,
    options.rawRequest,
    registry,
    options.session,
    secretTracker,
  );

  const buildFinalize =
    (activeIntent: UserIntent) =>
    (denials: ReadonlyMap<string, string>): unknown => {
      return rewriteExchangeResponse({
        wire,
        rawResponse: options.rawResponse,
        denialsByCallId: denials,
        redactText: (text) =>
          secretTracker.redactUnauthorizedInText(text, activeIntent.requestedTools)
            .text,
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

  const observations = observeToolResults(options.rawRequest, wire);
  let warrant = issueWarrant(taint(intent, 'USER'), registry);
  const decisions: ProxyDecision[] = [];
  const denialsByCallId = new Map<string, string>();
  const blockedTools: string[] = [];
  const pendingDrift = new Set(drifted);
  const refusedDrift = new Set<string>();

  for (const call of toolCalls) {
    if (pendingDrift.has(call.name) || refusedDrift.has(call.name)) {
      const drift = drifts.find((entry) => entry.toolName === call.name);
      const reason = `Warrant denied ${call.name}: ${drift?.reason ?? 'its advertised surface changed mid-session'}.`;
      const accepted =
        !refusedDrift.has(call.name) &&
        (await acceptDriftedTool(
          options,
          request.tools,
          call.name,
          call.rawArguments,
          reason,
        ));
      if (!accepted) {
        refusedDrift.add(call.name);
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
      pendingDrift.delete(call.name);
    }

    let decision: GuardDecision | null;
    try {
      decision = evaluateToolCall({
        mode: options.mode,
        warrant,
        registry,
        toolName: call.name,
        rawArguments: call.rawArguments,
        destinationOrigins: originsForCall(
          warrant,
          registry,
          call.name,
          call.rawArguments,
          observations,
        ),
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
        intent = intentAfterApproval(intent, decision, call.rawArguments, registry);
        warrant = issueWarrant(taint(intent, 'USER'), registry);
        decision =
          evaluateToolCall({
            mode: options.mode,
            warrant,
            registry,
            toolName: call.name,
            rawArguments: call.rawArguments,
            destinationOrigins: originsForCall(
              warrant,
              registry,
              call.name,
              call.rawArguments,
              observations,
            ),
          }) ?? decision;
      }
    }

    if (decision === null) {
      continue;
    }

    decision = denySecretLink(
      call,
      decision,
      secretTracker,
      intent.requestedTools,
      warrant,
    );

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
