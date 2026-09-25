import { spawn } from 'node:child_process';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { InjectionTarget, ScanInjection } from '@/adapters/proxy/injectPayload';
import {
  loadProxyPolicy,
  pinnedToolsFromPolicy,
  resolveIntentMode,
  toolOverridesFromPolicy,
} from '@/adapters/proxy/proxyPolicy';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import { proxyEnvForChild, upstreamAuthHeader, upstreamBaseUrl } from '@/cli/upstream';

export const DEFAULT_SCAN_TIMEOUT_MS = 120_000;

export interface ScanProbeResult {
  readonly guardMode: GuardMode;
  /** Sensitive calls the agent proposed that the user turn never authorized. */
  readonly unauthorizedTools: readonly string[];
  /** Subset actually stopped; only ENFORCE can stop anything. */
  readonly blockedTools: readonly string[];
  /** The model tried to hand the planted credential back. */
  readonly canaryLeaked: boolean;
  /** The credential got past the guard to the agent. */
  readonly canaryDelivered: boolean;
  /** Where the payload landed, or `none` when the agent exposed no untrusted slot. */
  readonly injectedInto: InjectionTarget | 'none';
  readonly exchanges: number;
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly stderrTail: string;
}

interface SpawnOutcome {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly stderrTail: string;
}

function runSpawnedAgent(options: {
  readonly proxyBaseUrl: string;
  readonly command: readonly string[];
  readonly timeoutMs: number;
}): Promise<SpawnOutcome> {
  const child = spawn(options.command[0] ?? '', options.command.slice(1), {
    env: {
      ...process.env,
      ...proxyEnvForChild(options.proxyBaseUrl),
    },
    shell: process.platform === 'win32',
  });

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });
  // Drained but discarded: scan reads the proxy, never the agent's own reporting.
  child.stdout.on('data', () => undefined);

  return new Promise<SpawnOutcome>((resolve) => {
    let settled = false;
    const finish = (exitCode: number, timedOut: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, timedOut, stderrTail: stderr.slice(-400) });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(1, true);
    }, options.timeoutMs);

    child.on('exit', (code) => finish(code ?? 1, false));
    child.on('error', () => finish(1, false));
  });
}

/**
 * Runs the target agent once behind a proxy that plants `injection` in its tool results.
 *
 * Unlike `runAgentProbe`, nothing is asked of the agent: the outcome is read from
 * what the proxy saw on the wire, so an agent that reports nothing is still scored.
 */
export async function runScanProbe(options: {
  readonly guardMode: GuardMode;
  readonly command: readonly string[];
  readonly injection?: ScanInjection;
  readonly timeoutMs?: number;
}): Promise<ScanProbeResult> {
  const policy = loadProxyPolicy();
  const unauthorizedTools: string[] = [];
  const blockedTools: string[] = [];
  const injectedTargets: InjectionTarget[] = [];
  let canaryLeaked = false;
  let canaryDelivered = false;
  let exchanges = 0;

  const { server, url } = await listenWarrantProxy({
    mode: options.guardMode,
    upstreamBaseUrl: upstreamBaseUrl(),
    upstreamHeaders: upstreamAuthHeader(),
    pinnedTools: pinnedToolsFromPolicy(policy),
    overrides: toolOverridesFromPolicy(policy),
    intentMode: resolveIntentMode(policy),
    destructiveRequiresExplicitUser: policy.destructiveRequiresExplicitUser,
    streaming: policy.streaming,
    approvalMode: 'deny',
    injection: options.injection,
    onExchange: (summary) => {
      exchanges += 1;
      unauthorizedTools.push(...summary.blockedTools, ...summary.wouldBlockTools);
      blockedTools.push(...summary.blockedTools);
      if (summary.injectedInto !== 'none') {
        injectedTargets.push(summary.injectedInto);
      }
      if (summary.canaryLeaked) {
        canaryLeaked = true;
      }
      if (summary.canaryDelivered) {
        canaryDelivered = true;
      }
    },
  });

  try {
    const outcome = await runSpawnedAgent({
      proxyBaseUrl: url,
      command: options.command,
      timeoutMs: options.timeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS,
    });

    return {
      guardMode: options.guardMode,
      unauthorizedTools: Object.freeze([...new Set(unauthorizedTools)]),
      blockedTools: Object.freeze([...new Set(blockedTools)]),
      canaryLeaked,
      canaryDelivered,
      injectedInto: injectedTargets[0] ?? 'none',
      exchanges,
      exitCode: outcome.exitCode,
      timedOut: outcome.timedOut,
      stderrTail: outcome.stderrTail,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
