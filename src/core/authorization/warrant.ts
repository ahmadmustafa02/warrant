import { isTrusted } from '../provenance/tainted';
import type { TaintedValue } from '../provenance/types';
import type { ToolRegistry } from '../tools/registry';

/** A single authorized action, optionally narrowed by parameters the user fixed. */
export interface Grant {
  readonly tool: string;
  /**
   * Parameter values the user actually specified.
   *
   * Untrusted content may fill parameters that are absent here — that is normal
   * agent behaviour and blocking it would wreck the benign-pass rate. What content
   * may never do is contradict a parameter the user pinned.
   */
  readonly pinnedParameters: Readonly<Record<string, string>>;
}

export interface UserIntent {
  readonly requestedTools: readonly string[];
  readonly pinnedParameters?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

export interface Warrant {
  readonly grants: readonly Grant[];
  readonly issuedAt: string;
  /** Requested names with no registered tool, kept for diagnostics rather than dropped. */
  readonly unknownTools: readonly string[];
}

export class WarrantIssuanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarrantIssuanceError';
  }
}

/**
 * Issues the permission set for one turn.
 *
 * Two properties make this the load-bearing function of the project. It accepts
 * intent only from an authoritative origin, so a warrant can never be derived from
 * content the attacker controls. And it returns a frozen structure, so injected
 * instructions arriving later in the turn have nothing left to edit.
 *
 * This is also why the defense generalizes to attacks nobody has seen: it never
 * inspects the wording of anything.
 */
export function issueWarrant(
  intent: TaintedValue<UserIntent>,
  registry: ToolRegistry,
  clock: () => Date = () => new Date(),
): Warrant {
  if (!isTrusted(intent)) {
    throw new WarrantIssuanceError(
      `a warrant may only be issued from an authoritative turn, but the intent carried provenance [${intent.sources.join(', ')}]`,
    );
  }

  const { requestedTools, pinnedParameters = {} } = intent.value;
  const grants: Grant[] = [];
  const unknownTools: string[] = [];
  const granted = new Set<string>();

  for (const tool of requestedTools) {
    if (!registry.has(tool)) {
      unknownTools.push(tool);
      continue;
    }
    if (granted.has(tool)) {
      continue;
    }
    granted.add(tool);
    grants.push(
      Object.freeze({
        tool,
        pinnedParameters: Object.freeze({ ...(pinnedParameters[tool] ?? {}) }),
      }),
    );
  }

  return Object.freeze({
    grants: Object.freeze(grants),
    issuedAt: clock().toISOString(),
    unknownTools: Object.freeze(unknownTools),
  });
}

export function findGrant(warrant: Warrant, tool: string): Grant | undefined {
  return warrant.grants.find((grant) => grant.tool === tool);
}
