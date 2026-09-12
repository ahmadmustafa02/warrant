/**
 * How much damage a tool can do.
 *
 * Risk tiering is what keeps the guard usable. The overwhelming majority of agent
 * tool calls are reads, and they are left completely alone, so the benign-pass rate
 * stays high and the guard only intervenes where consequences are real.
 */
import {
  compileParameterConstraint,
  type ParameterConstraints,
} from './parameterConstraints';

export const RISK_TIERS = ['READ_ONLY', 'SENSITIVE', 'DESTRUCTIVE'] as const;

export type RiskTier = (typeof RISK_TIERS)[number];

export interface ToolDefinition {
  readonly name: string;
  readonly riskTier: RiskTier;
  readonly description: string;
  /**
   * When true, a nominally read-only tool can still reach outside the agent (HTTP,
   * filesystem, …) and therefore requires a warrant and authority-parameter checks.
   */
  readonly egress?: boolean;
  /**
   * Parameter names this tool accepts — used by `auditToolRegistry` only.
   */
  readonly observedParameters?: readonly string[];
  /**
   * Parameters that decide where an action lands (recipient, path, amount, …).
   *
   * Untrusted content may fill ordinary payload fields, but it may not choose
   * these — they must come from the user turn or match a user-pinned value.
   */
  readonly authorityParameters?: readonly string[];
  /** Declarative limits on argument values (SQL shape, numeric ceilings, …). */
  readonly parameterConstraints?: ParameterConstraints;
}

export class DuplicateToolError extends Error {
  constructor(readonly toolName: string) {
    super(`tool "${toolName}" is already registered`);
    this.name = 'DuplicateToolError';
  }
}

export class ToolDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolDefinitionError';
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(definitions: readonly ToolDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  /**
   * Rejects redeclaration rather than overwriting. Silent replacement would let a
   * later registration downgrade an existing tool's risk tier.
   */
  register(definition: ToolDefinition): this {
    if (this.tools.has(definition.name)) {
      throw new DuplicateToolError(definition.name);
    }

    const authorityParameters = definition.authorityParameters ?? [];
    const egress = definition.egress === true;

    if (
      definition.riskTier === 'READ_ONLY' &&
      authorityParameters.length > 0 &&
      !egress
    ) {
      throw new ToolDefinitionError(
        `"${definition.name}" is READ_ONLY without egress, so its authorityParameters would never be enforced`,
      );
    }
    if (egress && authorityParameters.length === 0) {
      throw new ToolDefinitionError(
        `"${definition.name}" is egress-capable and must declare authorityParameters for its destination`,
      );
    }

    const parameterConstraints = definition.parameterConstraints;
    if (parameterConstraints !== undefined) {
      for (const constraint of Object.values(parameterConstraints)) {
        try {
          compileParameterConstraint(constraint);
        } catch {
          throw new ToolDefinitionError(
            `"${definition.name}" has an invalid parameter constraint`,
          );
        }
      }
    }

    this.tools.set(
      definition.name,
      Object.freeze({
        ...definition,
        ...(definition.authorityParameters === undefined
          ? {}
          : { authorityParameters: Object.freeze([...authorityParameters]) }),
        ...(parameterConstraints === undefined
          ? {}
          : { parameterConstraints: Object.freeze({ ...parameterConstraints }) }),
      }),
    );
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): readonly ToolDefinition[] {
    return Object.freeze([...this.tools.values()]);
  }

  /**
   * Unknown tools require a warrant.
   *
   * Failing closed is essential here: a tool introduced at runtime — say by a
   * poisoned MCP server advertising a new capability — must not slip past the guard
   * merely by being absent from the registry.
   */
  requiresWarrant(name: string): boolean {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      return true;
    }
    return tool.riskTier !== 'READ_ONLY' || tool.egress === true;
  }
}

const EGRESS_DESTINATION_HINTS = new Set([
  'url',
  'uri',
  'path',
  'host',
  'hostname',
  'endpoint',
  'destination',
]);

/**
 * Static checks integrators run before shipping a registry — no model calls.
 */
export function auditToolRegistry(registry: ToolRegistry): readonly string[] {
  const findings: string[] = [];

  for (const tool of registry.list()) {
    const params = tool.observedParameters ?? [];
    const hints = params.filter((name) => EGRESS_DESTINATION_HINTS.has(name));
    if (tool.riskTier === 'READ_ONLY' && tool.egress !== true && hints.length > 0) {
      findings.push(
        `"${tool.name}" is READ_ONLY but accepts [${hints.join(', ')}]; set egress: true and authorityParameters or rename parameters`,
      );
    }
  }

  return Object.freeze(findings);
}
