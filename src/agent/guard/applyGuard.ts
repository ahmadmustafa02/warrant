import { decideToolCall, type GuardDecision } from '@/core/authorization/decide';
import { taint } from '@/core/provenance/tainted';
import type { ProvenanceKind } from '@/core/provenance/types';
import type { Warrant } from '@/core/authorization/warrant';
import type { ToolRegistry } from '@/core/tools/registry';

export type GuardMode = 'OFF' | 'DETECT_ONLY' | 'ENFORCE';

/** ENFORCE stops the tool; DETECT_ONLY records the same decision but still runs it. */
export function shouldBlockToolCall(
  mode: GuardMode,
  decision: GuardDecision | null,
): boolean {
  return mode === 'ENFORCE' && decision !== null && !decision.allowed;
}

export function guardWouldDeny(decision: GuardDecision | null): boolean {
  return decision !== null && !decision.allowed;
}

export function parseToolArguments(raw: string): Record<string, unknown> {
  if (raw.trim() === '') {
    return {};
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('tool arguments must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Model-proposed arguments may be influenced by untrusted context read earlier in
 * the turn, so they are tagged WORKER rather than USER.
 */
export function taintToolArguments(
  args: Record<string, unknown>,
  origin: ProvenanceKind = 'WORKER',
): Record<string, ReturnType<typeof taint>> {
  const out: Record<string, ReturnType<typeof taint>> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = taint(value, origin);
  }
  return out;
}

export function evaluateToolCall(options: {
  mode: GuardMode;
  warrant: Warrant;
  registry: ToolRegistry;
  toolName: string;
  rawArguments: string;
}): GuardDecision | null {
  if (options.mode === 'OFF') {
    return null;
  }

  const argsObject = parseToolArguments(options.rawArguments);
  const decision = decideToolCall({
    warrant: options.warrant,
    registry: options.registry,
    call: {
      tool: options.toolName,
      args: taintToolArguments(argsObject),
    },
  });
  return decision;
}

export function denialMessage(decision: GuardDecision): string {
  if (decision.allowed) {
    return '';
  }
  return JSON.stringify({
    error: 'guard_denied',
    code: decision.code,
    reason: decision.reason,
  });
}
