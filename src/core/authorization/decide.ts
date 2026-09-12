import { describeValue, isUntrusted, sourcesOfArguments } from '../provenance/tainted';
import type { ProvenanceKind, TaintedValue } from '../provenance/types';
import type { RiskTier, ToolRegistry } from '../tools/registry';
import { findGrant, type Warrant } from './warrant';

export type DenialCode =
  | 'UNKNOWN_TOOL'
  | 'NO_WARRANT_FOR_TOOL'
  | 'PINNED_PARAMETER_CONFLICT'
  | 'AUTHORITY_PARAMETER_FROM_CONTENT'
  | 'AUTHORITY_PARAMETER_MISSING';

export type AuthorizationBasis = 'USER_WARRANT' | 'RISK_TIER';

export interface ProposedToolCall {
  readonly tool: string;
  readonly args: Readonly<Record<string, TaintedValue<unknown>>>;
}

export interface AllowedDecision {
  readonly allowed: true;
  readonly tool: string;
  readonly riskTier: RiskTier;
  readonly authorizedBy: AuthorizationBasis;
  readonly taintSources: readonly ProvenanceKind[];
  readonly reason: string;
}

export interface DeniedDecision {
  readonly allowed: false;
  readonly tool: string;
  readonly riskTier: RiskTier | undefined;
  readonly code: DenialCode;
  readonly taintSources: readonly ProvenanceKind[];
  readonly reason: string;
}

export type GuardDecision = AllowedDecision | DeniedDecision;

export interface DecisionInput {
  readonly warrant: Warrant;
  readonly registry: ToolRegistry;
  readonly call: ProposedToolCall;
}

/**
 * Decides whether a proposed tool call is covered by the warrant issued for this turn.
 *
 * The rule this implements, stated precisely: untrusted content may supply
 * *parameters* for an action the user already authorized, but it can never *expand*
 * the set of authorized actions. Tainted arguments alone are therefore not grounds
 * for denial — an agent summarizing a document will naturally pass text from that
 * document into its next call, and that is legitimate.
 *
 * Every reason string is written to be read by a human reviewing a trace, because a
 * denial nobody can explain is a denial nobody will trust.
 */
export function decideToolCall(input: DecisionInput): GuardDecision {
  const { warrant, registry, call } = input;
  const taintSources = sourcesOfArguments(call.args);
  const definition = registry.get(call.tool);

  if (definition === undefined) {
    return {
      allowed: false,
      tool: call.tool,
      riskTier: undefined,
      code: 'UNKNOWN_TOOL',
      taintSources,
      reason: `"${call.tool}" is not a registered tool, so it is refused rather than assumed harmless`,
    };
  }

  if (definition.riskTier === 'READ_ONLY') {
    return {
      allowed: true,
      tool: call.tool,
      riskTier: definition.riskTier,
      authorizedBy: 'RISK_TIER',
      taintSources,
      reason: `${call.tool} is read-only and needs no warrant, so ordinary work is never obstructed`,
    };
  }

  const grant = findGrant(warrant, call.tool);
  if (grant === undefined) {
    return {
      allowed: false,
      tool: call.tool,
      riskTier: definition.riskTier,
      code: 'NO_WARRANT_FOR_TOOL',
      taintSources,
      reason: `this turn authorized no ${call.tool} action; content may supply parameters but cannot add capabilities`,
    };
  }

  for (const [parameter, pinned] of Object.entries(grant.pinnedParameters)) {
    const supplied = call.args[parameter];
    // A pinned parameter the call omits is left to the tool's own validation; there
    // is no escalation in failing to provide an argument.
    if (supplied === undefined) {
      continue;
    }
    const suppliedText = describeValue(supplied.value);
    if (suppliedText !== pinned) {
      return {
        allowed: false,
        tool: call.tool,
        riskTier: definition.riskTier,
        code: 'PINNED_PARAMETER_CONFLICT',
        taintSources,
        reason: `the user pinned ${parameter} to "${pinned}" but this call supplies "${suppliedText}"`,
      };
    }
  }

  for (const parameter of definition.authorityParameters ?? []) {
    const supplied = call.args[parameter];
    const pinned = grant.pinnedParameters[parameter];

    if (supplied === undefined) {
      // Omitting a pinned authority parameter is an escalation, unlike omitting an
      // ordinary one: the tool falls back to its own default, so the action lands
      // somewhere the user did not choose.
      if (pinned === undefined) {
        continue;
      }
      return {
        allowed: false,
        tool: call.tool,
        riskTier: definition.riskTier,
        code: 'AUTHORITY_PARAMETER_MISSING',
        taintSources,
        reason: `the user pinned ${parameter} to "${pinned}" but this call omits it, which would leave the target to a tool default`,
      };
    }

    if (!isUntrusted(supplied)) {
      continue;
    }
    if (pinned !== undefined && describeValue(supplied.value) === pinned) {
      // Model/worker taint on an argument that still matches the user pin is OK.
      continue;
    }
    return {
      allowed: false,
      tool: call.tool,
      riskTier: definition.riskTier,
      code: 'AUTHORITY_PARAMETER_FROM_CONTENT',
      taintSources,
      reason: `${parameter} decides where this action lands; content may not choose it unless the user pinned that value`,
    };
  }

  return {
    allowed: true,
    tool: call.tool,
    riskTier: definition.riskTier,
    authorizedBy: 'USER_WARRANT',
    taintSources,
    reason: `${call.tool} was authorized by the user before any untrusted content was read`,
  };
}
