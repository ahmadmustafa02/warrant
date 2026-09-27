import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { DecisionSource } from '@/adapters/proxy/decisionRecord';
import { toDecisionRecords } from '@/adapters/proxy/decisionRecord';
import type { ProxyDecision } from '@/adapters/proxy/guardExchange';

export const DEFAULT_DECISION_LOG_MAX_BYTES = 5 * 1024 * 1024;

export interface DecisionLogAppend {
  readonly decisions: readonly ProxyDecision[];
  readonly mode: GuardMode;
  readonly source: DecisionSource;
  readonly canary?: string;
}

export interface DecisionLogSink {
  readonly path: string;
  readonly sessionId: string;
  append(entry: DecisionLogAppend): void;
}

export function rotatedDecisionLogPath(filePath: string): string {
  const base = basename(filePath);
  const stem = base.endsWith('.ndjson') ? base.slice(0, -'.ndjson'.length) : base;
  return join(dirname(filePath), `${stem}.1.ndjson`);
}

/** `off` disables the log. An empty value keeps the default path. */
export function resolveDecisionLogPath(
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): string | null {
  const raw = env.WARRANT_DECISION_LOG?.trim();
  if (raw === 'off') {
    return null;
  }
  if (raw !== undefined && raw !== '') {
    return raw;
  }
  return join(cwd, '.warrant', 'decisions.ndjson');
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

/**
 * Append-only log of guard decisions.
 *
 * Writes are synchronous so a line cannot be lost to a floating promise, and a
 * failure is swallowed after one warning: the log is a record, not a control.
 */
export function createDecisionLogSink(options?: {
  readonly path?: string;
  readonly maxBytes?: number;
  readonly sessionId?: string;
  readonly now?: () => Date;
  readonly warn?: (message: string) => void;
  readonly env?: Record<string, string | undefined>;
}): DecisionLogSink | null {
  const path = options?.path ?? resolveDecisionLogPath(options?.env ?? process.env);
  if (path === null) {
    return null;
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_DECISION_LOG_MAX_BYTES;
  const sessionId = options?.sessionId ?? randomUUID();
  const now = options?.now ?? ((): Date => new Date());
  const warn = options?.warn ?? ((message: string): void => console.error(message));
  let warned = false;

  const warnOnce = (error: unknown): void => {
    if (warned) {
      return;
    }
    warned = true;
    const detail = error instanceof Error ? error.message : 'unknown error';
    warn(`Warrant could not write the decision log (${path}): ${detail}`);
  };

  const writeLine = (line: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    let size = 0;
    try {
      size = statSync(path).size;
    } catch (error) {
      if (!isEnoent(error)) {
        throw error;
      }
    }
    if (size > 0 && size + Buffer.byteLength(line) > maxBytes) {
      const rotated = rotatedDecisionLogPath(path);
      rmSync(rotated, { force: true });
      renameSync(path, rotated);
    }
    appendFileSync(path, line, 'utf8');
  };

  return {
    path,
    sessionId,
    append(entry: DecisionLogAppend): void {
      try {
        const records = toDecisionRecords(entry.decisions, {
          sessionId,
          source: entry.source,
          mode: entry.mode,
          at: now().toISOString(),
          canary: entry.canary,
        });
        for (const record of records) {
          writeLine(`${JSON.stringify(record)}\n`);
        }
      } catch (error) {
        warnOnce(error);
      }
    },
  };
}
