import {
  detectToolSetDrift,
  establishToolSetBaseline,
  type AdvertisedTool,
  type ToolDrift,
  type ToolSetBaseline,
} from '@/core/tools/toolSetDrift';

/**
 * Per-run memory for the one thing the proxy has to remember: the capability
 * surface this agent started with.
 *
 * A session is scoped to a single `warrant guard` invocation, which is why the
 * baseline can be taken from the first request observed. That has a real limit — if
 * the very first request is already poisoned, the poisoned tool becomes the
 * baseline and drift cannot see it. Pinning the baseline from a policy file closes
 * that gap, because then the expected tool set comes from disk rather than from
 * traffic the attacker may already influence.
 */
export class ProxySession {
  private baseline: ToolSetBaseline | undefined;

  constructor(pinnedTools?: readonly AdvertisedTool[]) {
    if (pinnedTools !== undefined) {
      this.baseline = establishToolSetBaseline(pinnedTools);
    }
  }

  get hasBaseline(): boolean {
    return this.baseline !== undefined;
  }

  /**
   * Records the first advertised set, then reports how later ones differ from it.
   *
   * The baseline is deliberately never updated. Accepting an observed change would
   * let an attacker advertise a capability on one turn purely to have it treated as
   * normal on the next.
   */
  observeTools(tools: readonly AdvertisedTool[]): readonly ToolDrift[] {
    if (this.baseline === undefined) {
      this.baseline = establishToolSetBaseline(tools);
      return [];
    }
    return detectToolSetDrift(this.baseline, tools);
  }
}
