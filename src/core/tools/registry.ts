/**
 * How much damage a tool can do.
 *
 * Risk tiering is what keeps the guard usable. The overwhelming majority of agent
 * tool calls are reads, and they are left completely alone, so the benign-pass rate
 * stays high and the guard only intervenes where consequences are real.
 */
export const RISK_TIERS = ['READ_ONLY', 'SENSITIVE', 'DESTRUCTIVE'] as const;

export type RiskTier = (typeof RISK_TIERS)[number];

export interface ToolDefinition {
  readonly name: string;
  readonly riskTier: RiskTier;
  readonly description: string;
  /**
   * Parameters that decide where an action lands (recipient, path, amount, …).
   *
   * Untrusted content may fill ordinary payload fields, but it may not choose
   * these — they must come from the user turn or match a user-pinned value.
   */
  readonly authorityParameters?: readonly string[];
}

export class DuplicateToolError extends Error {
  constructor(readonly toolName: string) {
    super(`tool "${toolName}" is already registered`);
    this.name = 'DuplicateToolError';
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
    this.tools.set(definition.name, Object.freeze({ ...definition }));
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
    return tool.riskTier !== 'READ_ONLY';
  }
}
