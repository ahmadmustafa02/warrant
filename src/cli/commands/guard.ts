import 'dotenv/config';
import * as p from '@clack/prompts';
import { spawnUserCommand } from '@/lib/spawnCommand';
import {
  loadProxyPolicy,
  pinnedToolsFromPolicy,
  resolveIntentMode,
  toolOverridesFromPolicy,
} from '@/adapters/proxy/proxyPolicy';
import { ApprovalCoordinator } from '@/adapters/proxy/proxyApproval';
import { startMcpStdioProxy } from '@/adapters/mcp/mcpStdioProxy';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import type { GuardMode } from '@/agent/guard/applyGuard';
import {
  clackApprovalPrompt,
  nonInteractiveApprovalPrompt,
} from '@/cli/ui/approvalPrompt';
import { createDecisionLogSink } from '@/cli/decisionLog/fileSink';
import { proxyEnvForChild, upstreamAuthHeader, upstreamBaseUrl } from '@/cli/upstream';
import {
  modeBadge,
  statusOk,
  statusWarn,
  warrantBanner,
  warrantRule,
} from '@/cli/ui/brand';

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function parseGuardArgs(argv: readonly string[]): {
  mode: GuardMode;
  command: string[];
  noApproval: boolean;
  mcp: boolean;
  userTurn: string;
} {
  const mode: GuardMode = argv.includes('--detect-only')
    ? 'DETECT_ONLY'
    : argv.includes('--off')
      ? 'OFF'
      : 'ENFORCE';
  const noApproval = argv.includes('--no-approval');
  const mcp = argv.includes('--mcp');
  const userTurn =
    readFlag(argv, '--user') ?? process.env.WARRANT_USER_TURN?.trim() ?? '';

  const dash = argv.indexOf('--');
  if (dash < 0 || dash === argv.length - 1) {
    throw new Error(
      'Usage: warrant guard [--detect-only | --off] [--no-approval] [--mcp] [--user TEXT] -- <command...>',
    );
  }

  return { mode, command: argv.slice(dash + 1), noApproval, mcp, userTurn };
}

async function runMcpGuardCommand(options: {
  readonly mode: GuardMode;
  readonly command: readonly string[];
  readonly userTurn: string;
}): Promise<number> {
  const decisionLog = createDecisionLogSink();
  const { done } = await startMcpStdioProxy({
    mode: options.mode,
    userTurn: options.userTurn,
    command: options.command,
    onEvent: ({ decisions, blockedTools, wouldBlockTools }) => {
      decisionLog?.append({ decisions, mode: options.mode, source: 'guard' });
      if (blockedTools.length > 0) {
        process.stderr.write(`Warrant blocked: ${blockedTools.join(', ')}\n`);
      }
      if (wouldBlockTools.length > 0) {
        process.stderr.write(`Warrant would block: ${wouldBlockTools.join(', ')}\n`);
      }
    },
  });
  return done;
}

export async function runGuardCommand(argv: readonly string[]): Promise<number> {
  const { mode, command, noApproval, mcp, userTurn } = parseGuardArgs(argv);
  if (mcp) {
    return runMcpGuardCommand({ mode, command, userTurn });
  }

  p.intro(warrantBanner('Guard — route model traffic through the local proxy'));
  const policy = loadProxyPolicy();
  const intentMode = resolveIntentMode(policy);
  const headers = upstreamAuthHeader();

  if (Object.keys(headers).length === 0) {
    p.log.warn(
      'No GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY in this shell — forwarding Authorization from the agent when present.',
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

  const decisionLog = createDecisionLogSink();

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
    onExchange: ({ blockedTools, wouldBlockTools, drifts, decisions }) => {
      decisionLog?.append({ decisions, mode, source: 'guard' });
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
  if (decisionLog !== null) {
    p.log.info(`Decisions  ${decisionLog.path}`);
  }
  p.log.step(`Running: ${command.join(' ')}`);

  const child = spawnUserCommand(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...proxyEnvForChild(url),
    },
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
