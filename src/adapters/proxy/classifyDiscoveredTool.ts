import {
  ToolRegistry,
  type RiskTier,
  type ToolDefinition,
} from '@/core/tools/registry';
import type { DiscoveredTool } from './canonical';

/**
 * Risk tiers for tools the proxy never saw declared.
 *
 * Classification reads the tool's own name — the one thing every provider protocol
 * carries — and never its description, because a description travels with the
 * tool and an attacker who controls an MCP server controls that text.
 */

const DESTRUCTIVE_TOKENS = new Set([
  'delete',
  'remove',
  'drop',
  'destroy',
  'purge',
  'revoke',
  'transfer',
  'refund',
  'charge',
  'pay',
  'purchase',
  'wire',
  'deploy',
  'reset',
  'overwrite',
  'truncate',
  'terminate',
  'shutdown',
]);

const SIDE_EFFECT_TOKENS = new Set([
  'send',
  'email',
  'mail',
  'post',
  'publish',
  'notify',
  'message',
  'sms',
  'upload',
  'write',
  'create',
  'update',
  'edit',
  'patch',
  'insert',
  'commit',
  'merge',
  'invite',
  'share',
  'execute',
  'run',
  'shell',
  'exec',
]);

const READ_TOKENS = new Set([
  'get',
  'read',
  'list',
  'search',
  'query',
  'find',
  'lookup',
  'describe',
  'show',
  'view',
  'count',
  'check',
  'inspect',
  'summarize',
  'summarise',
  'analyze',
  'analyse',
  'classify',
  'translate',
  'extract',
]);

/** Reaching outside the agent, so never warrant-exempt even when it only reads. */
const EGRESS_TOKENS = new Set([
  'fetch',
  'browse',
  'download',
  'request',
  'http',
  'curl',
  'crawl',
  'scrape',
]);

/** Parameters that decide where an action lands, or how much it moves. */
const AUTHORITY_PARAMETER_NAMES = new Set([
  'to',
  'recipient',
  'recipients',
  'cc',
  'bcc',
  'email',
  'address',
  'url',
  'uri',
  'endpoint',
  'host',
  'hostname',
  'path',
  'filepath',
  'destination',
  'dest',
  'target',
  'channel',
  'phone',
  'account',
  'amount',
  'currency',
  'repo',
  'bucket',
]);

export interface ToolOverride {
  readonly riskTier?: RiskTier;
  readonly authorityParameters?: readonly string[];
}

export function tokenizeToolName(name: string): readonly string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token !== '');
}

function inferRiskTier(tokens: readonly string[]): RiskTier {
  if (tokens.some((token) => DESTRUCTIVE_TOKENS.has(token))) {
    return 'DESTRUCTIVE';
  }
  if (tokens.some((token) => SIDE_EFFECT_TOKENS.has(token))) {
    return 'SENSITIVE';
  }
  if (tokens.some((token) => READ_TOKENS.has(token) || EGRESS_TOKENS.has(token))) {
    return 'READ_ONLY';
  }
  // Unrecognized verbs are treated as consequential. A tool that turns out to be a
  // harmless read costs one policy line; the reverse costs a breach.
  return 'SENSITIVE';
}

/**
 * Turns an observed tool into a guard-ready definition.
 *
 * The registry rejects contradictory definitions (a READ_ONLY tool with authority
 * parameters that would never be checked), so tiers and parameters are reconciled
 * here rather than discovered as a crash at registration time.
 */
export function classifyDiscoveredTool(
  tool: DiscoveredTool,
  override: ToolOverride = {},
): ToolDefinition {
  const tokens = tokenizeToolName(tool.name);
  const riskTier = override.riskTier ?? inferRiskTier(tokens);

  const authorityParameters =
    override.authorityParameters ??
    tool.parameterNames.filter((name) =>
      AUTHORITY_PARAMETER_NAMES.has(name.toLowerCase()),
    );

  const reachesOutside = tokens.some((token) => EGRESS_TOKENS.has(token));
  const description =
    tool.description === '' ? `Observed tool ${tool.name}.` : tool.description;

  if (riskTier === 'READ_ONLY') {
    // An outbound read still needs a destination check, and the registry requires a
    // declared authority parameter to mark one. Without a destination-shaped
    // parameter there is nothing to enforce, so it stays a plain read.
    if (reachesOutside && authorityParameters.length > 0) {
      return {
        name: tool.name,
        riskTier,
        description,
        egress: true,
        authorityParameters: Object.freeze([...authorityParameters]),
        observedParameters: Object.freeze([...tool.parameterNames]),
      };
    }
    return {
      name: tool.name,
      riskTier,
      description,
      observedParameters: Object.freeze([...tool.parameterNames]),
    };
  }

  return {
    name: tool.name,
    riskTier,
    description,
    observedParameters: Object.freeze([...tool.parameterNames]),
    ...(authorityParameters.length > 0
      ? { authorityParameters: Object.freeze([...authorityParameters]) }
      : {}),
  };
}

/** Duplicate advertised names collapse to the first definition rather than throwing. */
export function buildProxyRegistry(
  tools: readonly DiscoveredTool[],
  overrides: Readonly<Record<string, ToolOverride>> = {},
): ToolRegistry {
  const registry = new ToolRegistry();
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      continue;
    }
    seen.add(tool.name);
    registry.register(classifyDiscoveredTool(tool, overrides[tool.name] ?? {}));
  }
  return registry;
}
