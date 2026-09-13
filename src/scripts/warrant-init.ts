#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sandboxToolsForApi } from '@/agent/sandbox/tools';
import {
  loadProxyPolicy,
  saveProxyPolicy,
  type ProxyPolicy,
} from '@/adapters/proxy/proxyPolicy';

/**
 * Writes `.warrant/proxy-policy.json` so drift baselines and tool overrides survive
 * restarts. Pass `--from-sandbox` to seed pinned tools from the demo tool list.
 */
function main(): void {
  const root = process.cwd();
  const fromSandbox = process.argv.includes('--from-sandbox');
  const useLlm = process.argv.includes('--llm-intent');

  const existing = fs.existsSync(path.join(root, '.warrant', 'proxy-policy.json'))
    ? loadProxyPolicy(root)
    : undefined;

  const policy: ProxyPolicy = {
    intentMode: useLlm ? 'llm' : (existing?.intentMode ?? 'heuristic'),
    destructiveRequiresExplicitUser: existing?.destructiveRequiresExplicitUser ?? true,
    approvalMode: existing?.approvalMode ?? 'prompt',
    streaming: existing?.streaming ?? 'guard',
    toolOverrides: existing?.toolOverrides,
    pinnedTools: fromSandbox
      ? sandboxToolsForApi().map((tool) => ({
          name: tool.function.name,
          parameterNames: Object.keys(
            (tool.function.parameters['properties'] as
              Record<string, unknown> | undefined) ?? {},
          ),
        }))
      : existing?.pinnedTools,
  };

  saveProxyPolicy(root, policy);
  console.log(`Wrote ${path.join(root, '.warrant', 'proxy-policy.json')}`);
  console.log(JSON.stringify(policy, null, 2));
}

main();
