#!/usr/bin/env node
import 'dotenv/config';
/**
 * Runs a child process with model traffic routed through the local Warrant proxy.
 *
 * Example:
 *   pnpm exec tsx src/scripts/warrant-guard.ts -- node my-agent.js
 */
import { spawn } from 'node:child_process';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import type { GuardMode } from '@/agent/guard/applyGuard';

function parseArgs(argv: readonly string[]): {
  mode: GuardMode;
  command: string[];
} {
  const mode: GuardMode = argv.includes('--detect-only')
    ? 'DETECT_ONLY'
    : argv.includes('--off')
      ? 'OFF'
      : 'ENFORCE';

  const dash = argv.indexOf('--');
  if (dash < 0 || dash === argv.length - 1) {
    console.error('Usage: warrant-guard [--detect-only | --off] -- <command...>');
    process.exit(1);
  }

  return { mode, command: argv.slice(dash + 1) };
}

function upstreamBaseUrl(): string {
  const explicit = process.env.WARRANT_UPSTREAM?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit.replace(/\/$/, '');
  }
  const openAi = process.env.OPENAI_BASE_URL?.trim();
  if (openAi !== undefined && openAi !== '') {
    return openAi.replace(/\/$/, '');
  }
  return 'https://api.groq.com/openai/v1';
}

function upstreamAuthHeader(): Record<string, string> {
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

async function main(): Promise<void> {
  const { mode, command } = parseArgs(process.argv.slice(2));
  const headers = upstreamAuthHeader();
  if (Object.keys(headers).length === 0) {
    console.error(
      '[warrant] no GROQ_API_KEY/OPENAI_API_KEY in this shell; forwarding Authorization from the agent when present.',
    );
  }

  const { server, url } = await listenWarrantProxy({
    mode,
    upstreamBaseUrl: upstreamBaseUrl(),
    upstreamHeaders: headers,
    onExchange: ({ blockedTools, wouldBlockTools }) => {
      if (blockedTools.length > 0) {
        console.error(`[warrant] blocked: ${blockedTools.join(', ')}`);
      }
      if (wouldBlockTools.length > 0) {
        console.error(`[warrant] would block: ${wouldBlockTools.join(', ')}`);
      }
    },
  });

  console.error(`[warrant] proxy ${url} → ${upstreamBaseUrl()} (${mode})`);

  const child = spawn(command[0] ?? '', command.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENAI_BASE_URL: url,
      OPENAI_API_BASE: url,
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

  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
