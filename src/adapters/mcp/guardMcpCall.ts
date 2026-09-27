import { z } from 'zod';
import { evaluateToolCall, type GuardMode } from '@/agent/guard/applyGuard';
import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import type { DiscoveredTool } from '@/adapters/proxy/canonical';
import { buildProxyRegistry } from '@/adapters/proxy/classifyDiscoveredTool';
import { readSchemaParameters } from '@/adapters/proxy/schemaParameters';
import { deriveProxyIntent } from '@/adapters/proxy/deriveProxyIntent';
import type { ProxyDecision } from '@/adapters/proxy/guardExchange';
import type { ProxySession } from '@/adapters/proxy/proxySession';

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
});

const toolsCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const listedToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z
    .object({
      properties: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export function isJsonRpcRequest(value: unknown): value is {
  readonly jsonrpc?: '2.0';
  readonly id?: string | number;
  readonly method?: string;
  readonly params?: unknown;
} {
  return jsonRpcRequestSchema.safeParse(value).success;
}

export function isToolsCall(value: unknown): boolean {
  return isJsonRpcRequest(value) && value.method === 'tools/call';
}

export function toolsFromListResult(value: unknown): readonly DiscoveredTool[] {
  if (typeof value !== 'object' || value === null || !('result' in value)) {
    return [];
  }
  const result = (value as { result?: unknown }).result;
  if (typeof result !== 'object' || result === null || !('tools' in result)) {
    return [];
  }
  const tools = (result as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return [];
  }
  const discovered: DiscoveredTool[] = [];
  for (const tool of tools) {
    const parsed = listedToolSchema.safeParse(tool);
    if (!parsed.success) {
      continue;
    }
    const schema = readSchemaParameters({
      properties: parsed.data.inputSchema?.properties ?? {},
    });
    discovered.push({
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      parameterNames: schema.names,
      ...(Object.keys(schema.descriptions).length > 0
        ? { parameterDescriptions: schema.descriptions }
        : {}),
    });
  }
  return Object.freeze(discovered);
}

export function mcpDenialResult(
  id: string | number | undefined,
  reason: string,
): unknown {
  return {
    jsonrpc: '2.0',
    ...(id === undefined ? {} : { id }),
    result: {
      isError: true,
      content: [{ type: 'text', text: reason }],
    },
  };
}

export interface McpCallJudgement {
  readonly decision: ProxyDecision | undefined;
  readonly deny: boolean;
  readonly reason: string;
}

/**
 * Judges one MCP `tools/call` the same way the HTTP proxy judges a model tool
 * proposal. Arguments are untrusted (WORKER). The user turn is `--user`.
 */
export function judgeMcpToolCall(options: {
  readonly mode: GuardMode;
  readonly userTurn: string;
  readonly request: unknown;
  readonly advertised: readonly DiscoveredTool[];
  readonly session?: ProxySession;
}): McpCallJudgement {
  if (options.mode === 'OFF') {
    return { decision: undefined, deny: false, reason: '' };
  }
  if (!isJsonRpcRequest(options.request) || options.request.method !== 'tools/call') {
    return { decision: undefined, deny: false, reason: '' };
  }

  const parsed = toolsCallParamsSchema.safeParse(options.request.params);
  if (!parsed.success) {
    const reason =
      'Warrant blocked this MCP call: its arguments were not a named tool.';
    return {
      decision: {
        kind: 'MALFORMED',
        callId: String(options.request.id ?? 'mcp'),
        toolName: 'unknown',
        reason,
      },
      deny: options.mode === 'ENFORCE',
      reason,
    };
  }

  const advertised =
    options.advertised.find((tool) => tool.name === parsed.data.name) ??
    ({
      name: parsed.data.name,
      description: '',
      parameterNames: Object.keys(parsed.data.arguments ?? {}),
    } satisfies DiscoveredTool);

  const tools = options.advertised.some((tool) => tool.name === advertised.name)
    ? options.advertised
    : [...options.advertised, advertised];
  const registry = buildProxyRegistry(tools);
  const drifts = options.session?.observeTools(tools) ?? [];
  const drifted = drifts.some((drift) => drift.toolName === parsed.data.name);
  if (drifted) {
    const drift = drifts.find((entry) => entry.toolName === parsed.data.name);
    const reason = `Warrant denied ${parsed.data.name}: ${drift?.reason ?? 'its advertised surface changed mid-session'}.`;
    return {
      decision: {
        kind: 'DRIFT',
        callId: String(options.request.id ?? 'mcp'),
        toolName: parsed.data.name,
        reason,
      },
      deny: options.mode === 'ENFORCE',
      reason,
    };
  }

  const intent = deriveProxyIntent(options.userTurn, registry);
  const warrant = issueWarrant(taint(intent, 'USER'), registry);
  try {
    const decision = evaluateToolCall({
      mode: options.mode,
      warrant,
      registry,
      toolName: parsed.data.name,
      rawArguments: JSON.stringify(parsed.data.arguments ?? {}),
    });
    if (decision === null) {
      return { decision: undefined, deny: false, reason: '' };
    }
    const reason = decision.allowed
      ? decision.reason
      : `Warrant denied ${decision.tool} (${decision.code}): ${decision.reason}`;
    return {
      decision: {
        kind: 'GUARD',
        callId: String(options.request.id ?? 'mcp'),
        decision,
      },
      deny: options.mode === 'ENFORCE' && !decision.allowed,
      reason,
    };
  } catch {
    const reason = `Warrant blocked ${parsed.data.name}: its arguments were not valid JSON, so they could not be checked.`;
    return {
      decision: {
        kind: 'MALFORMED',
        callId: String(options.request.id ?? 'mcp'),
        toolName: parsed.data.name,
        reason,
      },
      deny: options.mode === 'ENFORCE',
      reason,
    };
  }
}
