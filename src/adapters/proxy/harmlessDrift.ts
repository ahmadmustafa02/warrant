import type { ToolDrift } from '@/core/tools/toolSetDrift';
import type { DiscoveredTool } from './canonical';
import { isHarmlessDiscoveredTool } from './classifyDiscoveredTool';
import type { ProxySession } from './proxySession';

/**
 * Drops new tools that cannot send, delete, or name a destination, and adds
 * them to the saved list. A risky new tool, and any tool that gains a
 * parameter, stays in the list so the guard still refuses it.
 */
export function blockingDrifts(
  session: ProxySession | undefined,
  drifts: readonly ToolDrift[],
  tools: readonly DiscoveredTool[],
): readonly ToolDrift[] {
  if (session === undefined) {
    return drifts;
  }
  const blocking: ToolDrift[] = [];
  for (const drift of drifts) {
    if (drift.kind !== 'NEW_TOOL') {
      blocking.push(drift);
      continue;
    }
    const tool = tools.find((entry) => entry.name === drift.toolName);
    if (tool === undefined || !isHarmlessDiscoveredTool(tool)) {
      blocking.push(drift);
      continue;
    }
    session.acceptTool({
      name: tool.name,
      parameterNames: [...tool.parameterNames],
    });
  }
  return blocking;
}
