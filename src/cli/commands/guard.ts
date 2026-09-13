import 'dotenv/config';
import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import {
  loadProxyPolicy,
  pinnedToolsFromPolicy,
  resolveIntentMode,
  toolOverridesFromPolicy,
} from '@/adapters/proxy/proxyPolicy';
import { ApprovalCoordinator } from '@/adapters/proxy/proxyApproval';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import type { GuardMode } from '@/agent/guard/applyGuard';
import {
  clackApprovalPrompt,
  nonInteractiveApprovalPrompt,
} from '@/cli/ui/approvalPrompt';
import {
  modeBadge,
  statusOk,
  statusWarn,
  warrantBanner,
  warrantRule,
} from '@/cli/ui/brand';

function parseGuardArgs(argv: readonly string[]): {
  mode: GuardMode;
  command: string[];
  noApproval: boolean;
} {
  const mode: GuardMode = argv.includes('--detect-only')
    ? 'DETECT_ONLY'
    : argv.includes('--off')
      ? 'OFF'
      : 'ENFORCE';
  const noApproval = argv.includes('--no-approval');

  const dash = argv.indexOf('--');
  if (dash < 0 || dash === argv.length - 1) {
    throw new Error(
      'Usage: warrant guard [--detect-only | --off] [--no-approval] -- <command...>',
    );
  }

  return { mode, command: argv.slice(dash + 1), noApproval };
}

function upstreamBaseUrl(): string {
  const explicit = process.env.WARRANT_UPSTREAM?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit.replace(/\/$/, '');
  }
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic !== undefined && anthropic !== '') {
    return 'https://api.anthropic.com/v1';
  }
  const openAi = process.env.OPENAI_BASE_URL?.trim();
  if (openAi !== undefined && openAi !== '') {
    return openAi.replace(/\/$/, '');
  }
  return 'https://api.groq.com/openai/v1';
}

function upstreamAuthHeader(): Record<string, string> {
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic !== undefined && anthropic !== '') {
    return {
      'x-api-key': anthropic,
      'anthropic-version': process.env.ANTHROPIC_VERSION?.trim() ?? '2023-06-01',
    };
  }
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq !== undefined && groq !== '') {
    return { authorization: `Bearer ${groq}` };
  }
  const openAi = process.env.OPENAI_API_KEY?.trim();
  if (openAi !== undefined && openAi !== '') {
    return { authorization: `Bearer ${openAi}` };
  }
  return {};
}

export async function runGuardCommand(argv: readonly string[]): Promise<number> {
  p.intro(warrantBanner('Guard — route model traffic through the local proxy'));

  const { mode, command, noApproval } = parseGuardArgs(argv);
  const policy = loadProxyPolicy();
  const intentMode = resolveIntentMode(policy);
  const headers = upstreamAuthHeader();

  if (Object.keys(headers).length === 0) {
    p.log.warn(
      'No GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY in this shell — forwarding Authorization from the agent when present.',
    );
  }

  const interactive =
    !noApproval &&
    policy.approvalMode === 'prompt' &&
    process.stdin.isTTY &&
    process.stdout.isTTY;

  const approval = new ApprovalCoordinator(
    interactive ? clackApprovalPrompt : nonInteractiveApprovalPrompt(),
    process.cwd(),
    interactive && mode === 'ENFORCE',
  );

  const spin = p.spinner();
  spin.start('Starting Warrant proxy');

  const { server, url } = await listenWarrantProxy({
    mode,
    upstreamBaseUrl: upstreamBaseUrl(),
    upstreamHeaders: headers,
    pinnedTools: pinnedToolsFromPolicy(policy),
    overrides: toolOverridesFromPolicy(policy),
    intentMode,
    destructiveRequiresExplicitUser: policy.destructiveRequiresExplicitUser,
    streaming: policy.streaming,
    approvalMode: policy.approvalMode,
    approval,
    onExchange: ({ blockedTools, wouldBlockTools, drifts }) => {
      for (const drift of drifts) {
        p.log.warn(`Tool-set drift (${drift.kind}): ${drift.reason}`);
      }
      if (blockedTools.length > 0) {
        p.log.error(`Blocked: ${blockedTools.join(', ')}`);
      }
      if (wouldBlockTools.length > 0) {
        p.log.info(`Would block: ${wouldBlockTools.join(', ')}`);
      }
    },
  });

  spin.stop(statusOk(`Proxy listening at ${url}`));
  p.log.message(warrantRule());
  p.log.info(
    [
      `${modeBadge(mode)}  guard mode`,
      `Intent   ${intentMode}`,
      `Stream   ${policy.streaming}`,
      `Approval ${interactive ? 'interactive' : 'deny-only'}`,
      `Upstream ${upstreamBaseUrl()}`,
    ].join('\n'),
  );
  p.log.step(`Running: ${command.join(' ')}`);

  const child = spawn(command[0] ?? '', command.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENAI_BASE_URL: url,
      OPENAI_API_BASE: url,
      ANTHROPIC_BASE_URL: url,
    },
    shell: process.platform === 'win32',
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (exitCode === 0) {
    p.outro(statusOk('Agent exited cleanly'));
  } else {
    p.outro(statusWarn(`Agent exited with code ${exitCode}`));
  }

  return exitCode;
}
