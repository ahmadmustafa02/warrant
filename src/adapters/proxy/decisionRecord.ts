import { z } from 'zod';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { DenialCode } from '@/core/authorization/decide';
import { PROVENANCE_KINDS } from '@/core/provenance/types';
import { RISK_TIERS } from '@/core/tools/registry';
import type { ProxyDecision } from './guardExchange';

export const DECISION_LOG_VERSION = 1;
export const REASON_MAX_CHARS = 300;

const DENIAL_CODES = [
  'UNKNOWN_TOOL',
  'NO_WARRANT_FOR_TOOL',
  'PINNED_PARAMETER_CONFLICT',
  'AUTHORITY_PARAMETER_FROM_CONTENT',
  'AUTHORITY_PARAMETER_MISSING',
  'DESTINATION_ORIGIN_UNCLEAR',
  'PARAMETER_CONSTRAINT_VIOLATION',
] as const satisfies readonly DenialCode[];

export const decisionRecordSchema = z.object({
  v: z.literal(DECISION_LOG_VERSION),
  at: z.string().datetime(),
  sessionId: z.string().min(1),
  source: z.enum(['guard', 'scan']),
  mode: z.enum(['DETECT_ONLY', 'ENFORCE']),
  tool: z.string().min(1),
  riskTier: z.enum(RISK_TIERS).optional(),
  verdict: z.enum(['allowed', 'denied', 'would-deny']),
  kind: z.enum(['GUARD', 'MALFORMED', 'DRIFT']),
  code: z.enum(DENIAL_CODES).optional(),
  authorizedBy: z.enum(['USER_WARRANT', 'RISK_TIER']).optional(),
  taintSources: z.array(z.enum(PROVENANCE_KINDS)),
  reason: z.string().max(REASON_MAX_CHARS),
});

export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type DecisionSource = DecisionRecord['source'];
export type DecisionVerdict = DecisionRecord['verdict'];

export interface DecisionLogContext {
  readonly sessionId: string;
  readonly source: DecisionSource;
  /** `OFF` records nothing: the guard did not decide. */
  readonly mode: GuardMode;
  readonly at: string;
  /** Replaced with `[canary]` so a scan credential never lands in the log. */
  readonly canary?: string;
}

function redactReason(reason: string, canary: string | undefined): string {
  const replaced =
    canary !== undefined && canary !== ''
      ? reason.split(canary).join('[canary]')
      : reason;
  return replaced.length > REASON_MAX_CHARS
    ? replaced.slice(0, REASON_MAX_CHARS)
    : replaced;
}

/**
 * Turns proxy decisions into log records.
 *
 * Arguments, prompts, and headers are not fields on `ProxyDecision`, so they
 * cannot be copied from here. A DETECT_ONLY denial is `would-deny`: the guard
 * judged it and then let it through.
 */
export function toDecisionRecords(
  decisions: readonly ProxyDecision[],
  context: DecisionLogContext,
): DecisionRecord[] {
  if (context.mode === 'OFF') {
    return [];
  }
  const mode = context.mode;

  return decisions.map((decision) => {
    const blocked = mode === 'ENFORCE' ? 'denied' : 'would-deny';
    if (decision.kind === 'GUARD') {
      const judged = decision.decision;
      return decisionRecordSchema.parse({
        v: DECISION_LOG_VERSION,
        at: context.at,
        sessionId: context.sessionId,
        source: context.source,
        mode,
        tool: judged.tool,
        verdict: judged.allowed ? 'allowed' : blocked,
        kind: 'GUARD',
        taintSources: [...judged.taintSources],
        reason: redactReason(judged.reason, context.canary),
        ...(judged.riskTier !== undefined ? { riskTier: judged.riskTier } : {}),
        ...(judged.allowed
          ? { authorizedBy: judged.authorizedBy }
          : { code: judged.code }),
      });
    }

    return decisionRecordSchema.parse({
      v: DECISION_LOG_VERSION,
      at: context.at,
      sessionId: context.sessionId,
      source: context.source,
      mode,
      tool: decision.toolName,
      verdict: blocked,
      kind: decision.kind,
      taintSources: [],
      reason: redactReason(decision.reason, context.canary),
    });
  });
}
