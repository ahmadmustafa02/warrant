import { TurnSecretTracker } from '@/core/output/turnSecrets';
import type { ToolRegistry } from '@/core/tools/registry';
import {
  detectToolSetDrift,
  establishToolSetBaseline,
  type AdvertisedTool,
  type ToolDrift,
  type ToolSetBaseline,
} from '@/core/tools/toolSetDrift';
import { appendAnthropicToolSecretsToTracker } from './ingestAnthropicToolResults';
import { appendGeminiToolSecretsToTracker } from './ingestGeminiToolResults';
import { appendOpenAiToolSecretsToTracker } from './ingestOpenAiToolResults';
import { appendResponsesToolSecretsToTracker } from './ingestResponsesToolResults';

/**
 * The capability surface this agent is allowed to advertise.
 *
 * A saved pin (or a policy list) is the baseline from the first request of every
 * later run. With no pin yet, the first list this process sees is saved. Traffic
 * never grows that list. Only `acceptTool`, after a person approves one tool,
 * does.
 *
 * The very first save can still be poisoned if that run was already attacked.
 * Deleting `.warrant/tool-pin.json` starts the pin over.
 */
export class ProxySession {
  private baseline: ToolSetBaseline | undefined;
  private savedTools: AdvertisedTool[] = [];
  /** Secrets seen in tool results across the whole `warrant guard` run. */
  readonly secretTracker = new TurnSecretTracker();

  constructor(
    pinnedTools?: readonly AdvertisedTool[],
    private readonly persistTools?: (tools: readonly AdvertisedTool[]) => void,
  ) {
    if (pinnedTools !== undefined) {
      this.savedTools = snapshotTools(pinnedTools);
      this.baseline = establishToolSetBaseline(this.savedTools);
    }
  }

  /**
   * A person approved this tool's current parameter list.
   *
   * Later requests in this run, and the next `warrant guard` run that loads the
   * saved pin, treat it as part of the baseline.
   */
  acceptTool(tool: AdvertisedTool): void {
    const next = this.savedTools.filter((entry) => entry.name !== tool.name);
    next.push(tool);
    this.savedTools = snapshotTools(next);
    this.baseline = establishToolSetBaseline(this.savedTools);
    this.persistTools?.(this.savedTools);
  }

  get hasBaseline(): boolean {
    return this.baseline !== undefined;
  }

  /**
   * Records the first advertised set, then reports how later ones differ from it.
   *
   * An observed change is not absorbed. An attacker must not be able to advertise
   * a capability on one turn and have it treated as normal on the next.
   */
  observeTools(tools: readonly AdvertisedTool[]): readonly ToolDrift[] {
    if (this.baseline === undefined) {
      this.savedTools = snapshotTools(tools);
      this.baseline = establishToolSetBaseline(this.savedTools);
      this.persistTools?.(this.savedTools);
      return [];
    }
    return detectToolSetDrift(this.baseline, tools);
  }

  ingestOpenAiRequestSecrets(rawRequest: unknown, registry: ToolRegistry): void {
    appendOpenAiToolSecretsToTracker(this.secretTracker, rawRequest, registry);
  }

  ingestResponsesRequestSecrets(rawRequest: unknown, registry: ToolRegistry): void {
    appendResponsesToolSecretsToTracker(this.secretTracker, rawRequest, registry);
  }

  ingestAnthropicRequestSecrets(rawRequest: unknown, registry: ToolRegistry): void {
    appendAnthropicToolSecretsToTracker(this.secretTracker, rawRequest, registry);
  }

  ingestGeminiRequestSecrets(rawRequest: unknown, registry: ToolRegistry): void {
    appendGeminiToolSecretsToTracker(this.secretTracker, rawRequest, registry);
  }
}

function snapshotTools(tools: readonly AdvertisedTool[]): AdvertisedTool[] {
  const baseline = establishToolSetBaseline(tools);
  return [...baseline.parametersByTool.entries()].map(([name, parameterNames]) => ({
    name,
    parameterNames: [...parameterNames],
  }));
}
