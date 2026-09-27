import { taint } from '../provenance/tainted';
import type { ToolRegistry } from '../tools/registry';
import { issueWarrant, type UserIntent, type Warrant } from './warrant';

export interface ExplicitGrantInput {
  readonly tool: string;
  readonly pinnedParameters?: Readonly<Record<string, string>>;
  readonly namedParties?: Readonly<Record<string, readonly string[]>>;
}

export class ExplicitGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplicitGrantError';
  }
}

export function userIntentFromExplicit(
  grants: readonly ExplicitGrantInput[],
): UserIntent {
  const requestedTools = grants.map((grant) => grant.tool);
  const pinnedParameters: Record<string, Record<string, string>> = {};
  const namedParties: Record<string, Record<string, readonly string[]>> = {};

  const seen = new Set<string>();
  for (const grant of grants) {
    // Deduplication would keep the first pin and silently discard a stricter one,
    // so ambiguous developer input is rejected instead of quietly narrowed.
    if (seen.has(grant.tool)) {
      throw new ExplicitGrantError(
        `"${grant.tool}" is granted twice; combine it into a single grant`,
      );
    }
    seen.add(grant.tool);
  }

  for (const grant of grants) {
    const pinned = grant.pinnedParameters;
    if (pinned !== undefined && Object.keys(pinned).length > 0) {
      pinnedParameters[grant.tool] = { ...pinned };
    }
    const parties = grant.namedParties;
    if (parties !== undefined && Object.keys(parties).length > 0) {
      namedParties[grant.tool] = parties;
    }
  }

  return {
    requestedTools,
    ...(Object.keys(pinnedParameters).length > 0 ? { pinnedParameters } : {}),
    ...(Object.keys(namedParties).length > 0 ? { namedParties } : {}),
  };
}

/**
 * Issues a warrant from grants the application already knows — no intent parser.
 *
 * Use this when the UX is structured ("Send summary to manager"): the human
 * decision is explicit in your code, and Warrant only freezes it before content
 * is read.
 */
export function issueWarrantFromExplicit(
  grants: readonly ExplicitGrantInput[],
  registry: ToolRegistry,
  clock: () => Date = () => new Date(),
): Warrant {
  return issueWarrant(taint(userIntentFromExplicit(grants), 'USER'), registry, clock);
}
