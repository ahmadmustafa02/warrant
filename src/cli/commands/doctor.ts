import * as p from '@clack/prompts';
import { createSandboxRegistry } from '@/agent/sandbox/tools';
import { auditToolRegistry } from '@/core/tools/registry';
import { loadProxyPolicy, proxyPolicyPath } from '@/adapters/proxy/proxyPolicy';
import fs from 'node:fs';
import { statusFail, statusOk, warrantBanner } from '@/cli/ui/brand';

export function runDoctorCommand(): Promise<number> {
  p.intro(warrantBanner('Doctor — environment and registry checks'));

  const registry = createSandboxRegistry();
  const findings = auditToolRegistry(registry);
  const policyPath = proxyPolicyPath(process.cwd());
  const hasPolicy = fs.existsSync(policyPath);

  const keys = [
    process.env.GROQ_API_KEY?.trim(),
    process.env.OPENAI_API_KEY?.trim(),
    process.env.ANTHROPIC_API_KEY?.trim(),
  ].filter((value) => value !== undefined && value !== '');

  if (keys.length === 0) {
    p.log.warn('No model API key in environment (GROQ / OpenAI / Anthropic).');
  } else {
    p.log.success('Model API key present.');
  }

  if (hasPolicy) {
    const policy = loadProxyPolicy();
    p.log.success(
      `Policy loaded (${policy.intentMode}, streaming ${policy.streaming}).`,
    );
  } else {
    p.log.warn('No .warrant/proxy-policy.json — run warrant init.');
  }

  if (findings.length === 0) {
    p.outro(statusOk('Registry audit clean'));
    return Promise.resolve(0);
  }

  p.log.error('Registry findings:');
  for (const line of findings) {
    p.log.message(`• ${line}`);
  }
  p.outro(statusFail('Fix registry findings before shipping'));
  return Promise.resolve(1);
}
