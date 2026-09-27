import 'dotenv/config';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { DecisionSessionView } from '@/cli/decisionLog/readDecisionLog';
import {
  queryDecisionSessions,
  readDecisionLog,
} from '@/cli/decisionLog/readDecisionLog';
import { resolveDecisionLogPath } from '@/cli/decisionLog/fileSink';
import type { DecisionSource } from '@/adapters/proxy/decisionRecord';
import { statusOk, statusWarn, warrantBanner } from '@/cli/ui/brand';

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function parseLimit(argv: readonly string[]): number {
  const raw = readFlag(argv, '--limit');
  if (raw === undefined) {
    return 50;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) {
    throw new Error('--limit must be a positive integer');
  }
  return value;
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'denied':
      return pc.red('denied');
    case 'would-deny':
      return pc.yellow('would-deny');
    default:
      return pc.green('allowed');
  }
}

function sessionBlock(view: DecisionSessionView): string {
  const rows = view.records
    .map((record) => {
      const code = record.code !== undefined ? ` ${record.code}` : '';
      const tier = record.riskTier !== undefined ? ` ${record.riskTier}` : '';
      return `  ${verdictLabel(record.verdict)}  ${record.tool}${tier}${code}\n    ${pc.dim(record.reason)}`;
    })
    .join('\n');
  const header = `${pc.bold(view.source)} ${pc.dim(view.sessionId)} ${pc.dim(view.mode)}\n  allowed ${view.allowed} · denied ${view.denied} · would-deny ${view.wouldDeny}`;
  return `${header}\n${rows}`;
}

export function runLogCommand(argv: readonly string[]): number {
  const json = argv.includes('--json');
  const path = resolveDecisionLogPath();
  if (path === null) {
    throw new Error('WARRANT_DECISION_LOG=off — there is no decision log to read');
  }

  const sources: DecisionSource[] = argv.includes('--include-scan')
    ? ['guard', 'scan']
    : ['guard'];
  const sessionId = readFlag(argv, '--session');
  const read = readDecisionLog(path);
  const sessions = queryDecisionSessions(read.records, {
    sources,
    sessionId,
    deniedOnly: argv.includes('--denied'),
    limit: parseLimit(argv),
  });

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ path, skipped: read.skipped, sessions }, null, 2)}\n`,
    );
    return 0;
  }

  p.intro(warrantBanner('Log — what the guard allowed and denied'));
  if (sessions.length === 0) {
    p.log.warn('No decisions logged yet.');
    p.outro(statusWarn('Run "warrant guard -- <your agent>" then look again'));
    return 0;
  }

  p.note(sessions.map(sessionBlock).join('\n\n'), 'Decisions');
  if (read.skipped > 0) {
    p.log.warn(
      `${read.skipped} line(s) skipped — they were not valid decision records`,
    );
  }
  p.outro(statusOk(`${sessions.length} session(s) from ${path}`));
  return 0;
}
