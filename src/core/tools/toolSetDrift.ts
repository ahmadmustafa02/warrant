/**
 * Capabilities that appear after a session has already started.
 *
 * The usual signals are useless against this attack. Reading a tool's name or
 * description tells you nothing when whoever injected the capability also wrote its
 * description — a poisoned MCP server can advertise `read_public_notes` and mean
 * anything by it. What it cannot forge is *when* the capability showed up.
 *
 * A tool absent at the outset cannot have been part of what the user authorized,
 * because the user's request was made before the tool existed. That makes drift
 * decidable from facts, with no judgment about wording, which is why it belongs
 * beside the rest of the authorization logic rather than in a detector.
 */

export type ToolDriftKind = 'NEW_TOOL' | 'MUTATED_TOOL';

export interface ToolDrift {
  readonly kind: ToolDriftKind;
  readonly toolName: string;
  readonly reason: string;
}

/** The advertised surface of one tool, reduced to what matters for drift. */
export interface AdvertisedTool {
  readonly name: string;
  readonly parameterNames: readonly string[];
}

export interface ToolSetBaseline {
  readonly parametersByTool: ReadonlyMap<string, readonly string[]>;
}

function normalizeParameters(names: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(names)].sort());
}

/**
 * Freezes the capability surface a session is allowed to have.
 *
 * A baseline is never updated once set. Absorbing an observed change would hand the
 * attacker the whole defense: advertise the new tool, have it accepted into the
 * baseline, then call it on the following turn.
 */
export function establishToolSetBaseline(
  tools: readonly AdvertisedTool[],
): ToolSetBaseline {
  const parametersByTool = new Map<string, readonly string[]>();
  for (const tool of tools) {
    if (parametersByTool.has(tool.name)) {
      continue;
    }
    parametersByTool.set(tool.name, normalizeParameters(tool.parameterNames));
  }
  return Object.freeze({ parametersByTool });
}

export function detectToolSetDrift(
  baseline: ToolSetBaseline,
  tools: readonly AdvertisedTool[],
): readonly ToolDrift[] {
  const drifts: ToolDrift[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      continue;
    }
    seen.add(tool.name);

    const known = baseline.parametersByTool.get(tool.name);
    if (known === undefined) {
      drifts.push({
        kind: 'NEW_TOOL',
        toolName: tool.name,
        reason: `"${tool.name}" was not advertised when this session began, so the user's request could not have authorized it`,
      });
      continue;
    }

    // Only added parameters count. Losing one removes a way to direct the action,
    // which is never an escalation; gaining one is how a trusted tool acquires a
    // destination it did not have when the user made their request.
    const added = normalizeParameters(tool.parameterNames).filter(
      (name) => !known.includes(name),
    );
    if (added.length > 0) {
      drifts.push({
        kind: 'MUTATED_TOOL',
        toolName: tool.name,
        reason: `"${tool.name}" gained parameter(s) [${added.join(', ')}] partway through the session`,
      });
    }
  }

  return Object.freeze(drifts);
}

export function driftedToolNames(drifts: readonly ToolDrift[]): ReadonlySet<string> {
  return new Set(drifts.map((drift) => drift.toolName));
}
