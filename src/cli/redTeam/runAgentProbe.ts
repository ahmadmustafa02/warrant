import { spawn } from 'node:child_process';
import type { GuardMode } from '@/agent/guard/applyGuard';
import { runProxyDemoAgent } from '@/agent/proxyDemo/runProxyDemoAgent';
import {
  loadProxyPolicy,
  pinnedToolsFromPolicy,
  resolveIntentMode,
  toolOverridesFromPolicy,
} from '@/adapters/proxy/proxyPolicy';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import type { AuthoredPayload } from '@/eval/payloads/types';
import { proxyEnvForChild, upstreamAuthHeader, upstreamBaseUrl } from '@/cli/upstream';
import type { ProxyDemoResult } from '@/agent/proxyDemo/runProxyDemoAgent';

export type AgentProbeResult = ProxyDemoResult & {
  readonly guardMode: GuardMode;
  readonly payloadId: string;
  readonly blockedTools: readonly string[];
  readonly wouldBlockTools: readonly string[];
};

const DEFAULT_USER_TURN = 'Please summarize document doc-1 for me in 2 sentences.';

async function withTemporaryEnv<T>(
  overlay: Readonly<Record<string, string>>,
  run: () => Promise<T>,
): Promise<T> {
  const snapshot = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overlay)) {
    snapshot.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, previous] of snapshot) {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
}

function parseProbeJson(stdout: string): ProxyDemoResult | undefined {
  const lines = stdout.trim().split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (line === undefined || line === '' || !line.startsWith('{')) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) {
        continue;
      }
      const record = parsed as Record<string, unknown>;
      if (typeof record.hijacked !== 'boolean' || !Array.isArray(record.calledTools)) {
        continue;
      }
      return {
        finalAnswer: typeof record.finalAnswer === 'string' ? record.finalAnswer : '',
        hijacked: record.hijacked,
        calledTools: record.calledTools.filter(
          (entry): entry is string => typeof entry === 'string',
        ),
        emailSent: record.emailSent === true,
        steps: typeof record.steps === 'number' ? record.steps : 0,
      };
    } catch {
      continue;
    }
  }
  return undefined;
}

async function runBundledDemoAgent(options: {
  readonly proxyBaseUrl: string;
  readonly payload: AuthoredPayload;
}): Promise<ProxyDemoResult> {
  const overlay = {
    ...proxyEnvForChild(options.proxyBaseUrl),
  };
  return withTemporaryEnv(overlay, () =>
    runProxyDemoAgent({
      userTurn: options.payload.userTurn ?? DEFAULT_USER_TURN,
      injectionLine: options.payload.injectionLine,
    }),
  );
}

async function runSpawnedAgent(options: {
  readonly proxyBaseUrl: string;
  readonly payload: AuthoredPayload;
  readonly command: readonly string[];
}): Promise<ProxyDemoResult> {
  const child = spawn(options.command[0] ?? '', options.command.slice(1), {
    env: {
      ...process.env,
      ...proxyEnvForChild(options.proxyBaseUrl),
      WARRANT_EVAL_USER_TURN: options.payload.userTurn ?? DEFAULT_USER_TURN,
      WARRANT_EVAL_INJECTION: options.payload.injectionLine,
    },
    shell: process.platform === 'win32',
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  const parsed = parseProbeJson(stdout);
  if (parsed === undefined) {
    throw new Error(
      `Agent probe produced no JSON result (exit ${exitCode}). ${stderr.slice(0, 400)}`,
    );
  }
  return parsed;
}

export async function runAgentProbe(options: {
  readonly guardMode: GuardMode;
  readonly payload: AuthoredPayload;
  readonly command?: readonly string[];
}): Promise<AgentProbeResult> {
  const policy = loadProxyPolicy();
  const blockedTools: string[] = [];
  const wouldBlockTools: string[] = [];

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
    onExchange: (summary) => {
      blockedTools.push(...summary.blockedTools);
      wouldBlockTools.push(...summary.wouldBlockTools);
    },
  });

  try {
    const parsed =
      options.command === undefined
        ? await runBundledDemoAgent({ proxyBaseUrl: url, payload: options.payload })
        : await runSpawnedAgent({
            proxyBaseUrl: url,
            payload: options.payload,
            command: options.command,
          });

    return {
      ...parsed,
      guardMode: options.guardMode,
      payloadId: options.payload.externalRef,
      blockedTools: Object.freeze([...new Set(blockedTools)]),
      wouldBlockTools: Object.freeze([...new Set(wouldBlockTools)]),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
