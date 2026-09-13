import 'dotenv/config';
import * as p from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { sandboxToolsForApi } from '@/agent/sandbox/tools';
import {
  loadProxyPolicy,
  saveProxyPolicy,
  type ProxyPolicy,
} from '@/adapters/proxy/proxyPolicy';
import { statusOk, warrantBanner } from '@/cli/ui/brand';

export function runInitCommand(argv: readonly string[]): Promise<number> {
  p.intro(warrantBanner('Init — write .warrant/proxy-policy.json'));

  const root = process.cwd();
  const fromSandbox = argv.includes('--from-sandbox');
  const useLlm = argv.includes('--llm-intent');

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
  p.log.success(`Wrote ${path.join(root, '.warrant', 'proxy-policy.json')}`);
  p.note(JSON.stringify(policy, null, 2), 'Policy');
  p.outro(statusOk('Ready — run warrant guard -- your-agent'));
  return Promise.resolve(0);
}
