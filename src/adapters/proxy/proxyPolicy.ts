import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ToolOverride } from './classifyDiscoveredTool';
import type { AdvertisedTool } from '@/core/tools/toolSetDrift';
import type { IntentParseMode } from '@/agent/intent/parseUserIntentLlm';

const toolOverrideSchema = z.object({
  riskTier: z.enum(['READ_ONLY', 'SENSITIVE', 'DESTRUCTIVE']).optional(),
  authorityParameters: z.array(z.string()).optional(),
  returnsSecrets: z.boolean().optional(),
});

export const proxyPolicySchema = z.object({
  intentMode: z.enum(['heuristic', 'llm']).default('heuristic'),
  /** When `prompt`, eligible ENFORCE denials ask on the CLI before blocking. */
  approvalMode: z.enum(['deny', 'prompt']).default('prompt'),
  /**
   * `block` — reject stream:true in ENFORCE.
   * `guard` — buffer upstream SSE, run the guard, return guarded SSE/JSON.
   */
  streaming: z.enum(['block', 'guard']).default('guard'),
  /** Expected tools for drift — use when the first live request may already be poisoned. */
  pinnedTools: z
    .array(
      z.object({
        name: z.string().min(1),
        parameterNames: z.array(z.string()).default([]),
      }),
    )
    .optional(),
  toolOverrides: z.record(z.string(), toolOverrideSchema).optional(),
  /** When true, destructive tools never enter a warrant from the LLM parser alone. */
  destructiveRequiresExplicitUser: z.boolean().default(true),
});

export type ProxyPolicy = z.infer<typeof proxyPolicySchema>;
export type StreamingPolicy = ProxyPolicy['streaming'];
export type ApprovalMode = ProxyPolicy['approvalMode'];

export const DEFAULT_PROXY_POLICY: ProxyPolicy = {
  intentMode: 'heuristic',
  destructiveRequiresExplicitUser: true,
  approvalMode: 'prompt',
  streaming: 'guard',
};

export function proxyPolicyPath(projectRoot: string): string {
  return path.join(projectRoot, '.warrant', 'proxy-policy.json');
}

export function loadProxyPolicy(projectRoot: string = process.cwd()): ProxyPolicy {
  const filePath = proxyPolicyPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return DEFAULT_PROXY_POLICY;
  }
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return proxyPolicySchema.parse(raw);
}

export function saveProxyPolicy(projectRoot: string, policy: ProxyPolicy): void {
  const dir = path.join(projectRoot, '.warrant');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    proxyPolicyPath(projectRoot),
    `${JSON.stringify(proxyPolicySchema.parse(policy), null, 2)}\n`,
    'utf8',
  );
}

export function pinnedToolsFromPolicy(
  policy: ProxyPolicy,
): readonly AdvertisedTool[] | undefined {
  if (policy.pinnedTools === undefined || policy.pinnedTools.length === 0) {
    return undefined;
  }
  return policy.pinnedTools.map((tool) => ({
    name: tool.name,
    parameterNames: tool.parameterNames,
  }));
}

export function toolOverridesFromPolicy(
  policy: ProxyPolicy,
): Readonly<Record<string, ToolOverride>> {
  const overrides = policy.toolOverrides ?? {};
  const out: Record<string, ToolOverride> = {};
  for (const [name, value] of Object.entries(overrides)) {
    out[name] = value;
  }
  return out;
}

export function resolveIntentMode(
  policy: ProxyPolicy,
  env: NodeJS.ProcessEnv = process.env,
): IntentParseMode {
  const fromEnv = env.WARRANT_INTENT?.trim();
  if (fromEnv === 'llm' || fromEnv === 'heuristic') {
    return fromEnv;
  }
  return policy.intentMode;
}
