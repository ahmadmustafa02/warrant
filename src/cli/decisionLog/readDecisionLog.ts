import { readFileSync } from 'node:fs';
import {
  decisionRecordSchema,
  type DecisionRecord,
  type DecisionSource,
} from '@/adapters/proxy/decisionRecord';
import { rotatedDecisionLogPath } from './fileSink';

export interface DecisionLogRead {
  readonly records: readonly DecisionRecord[];
  readonly skipped: number;
}

export interface DecisionSessionView {
  readonly sessionId: string;
  readonly source: DecisionSource;
  readonly mode: DecisionRecord['mode'];
  readonly allowed: number;
  readonly denied: number;
  readonly wouldDeny: number;
  /** Rows to show. Counts above include rows hidden by `--denied`. */
  readonly records: readonly DecisionRecord[];
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function readFileOrEmpty(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the current log and the one rotated file. A bad line is skipped and
 * counted. The file is untrusted input: nothing is returned that failed the schema.
 */
export function readDecisionLog(filePath: string): DecisionLogRead {
  const files = [
    { generation: 1, text: readFileOrEmpty(filePath) },
    { generation: 0, text: readFileOrEmpty(rotatedDecisionLogPath(filePath)) },
  ];

  const parsed: { record: DecisionRecord; generation: number; line: number }[] = [];
  let skipped = 0;

  for (const file of files) {
    if (file.text === null) {
      continue;
    }
    const lines = file.text.split('\n');
    for (let line = 0; line < lines.length; line += 1) {
      const raw = lines[line] ?? '';
      if (raw.trim() === '') {
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(raw) as unknown;
      } catch {
        skipped += 1;
        continue;
      }
      const result = decisionRecordSchema.safeParse(json);
      if (!result.success) {
        skipped += 1;
        continue;
      }
      parsed.push({ record: result.data, generation: file.generation, line });
    }
  }

  parsed.sort((left, right) => {
    if (left.record.at !== right.record.at) {
      return left.record.at < right.record.at ? 1 : -1;
    }
    if (left.generation !== right.generation) {
      return right.generation - left.generation;
    }
    return right.line - left.line;
  });

  return {
    records: parsed.map((entry) => entry.record),
    skipped,
  };
}

/**
 * Groups newest-first. Session counts cover every matching row; `--denied`
 * only changes which rows are listed.
 */
export function queryDecisionSessions(
  records: readonly DecisionRecord[],
  filter: {
    readonly sources: readonly DecisionSource[];
    readonly sessionId?: string;
    readonly deniedOnly?: boolean;
    readonly limit?: number;
  },
): DecisionSessionView[] {
  const scoped = records.filter((record) => {
    if (!filter.sources.includes(record.source)) {
      return false;
    }
    if (filter.sessionId !== undefined && record.sessionId !== filter.sessionId) {
      return false;
    }
    return true;
  });

  const groups = new Map<string, DecisionRecord[]>();
  for (const record of scoped) {
    const existing = groups.get(record.sessionId);
    if (existing === undefined) {
      groups.set(record.sessionId, [record]);
    } else {
      existing.push(record);
    }
  }

  const views: DecisionSessionView[] = [];
  for (const [sessionId, sessionRecords] of groups) {
    const newest = sessionRecords[0];
    if (newest === undefined) {
      continue;
    }
    const shown =
      filter.deniedOnly === true
        ? sessionRecords.filter((record) => record.verdict !== 'allowed')
        : sessionRecords;
    if (shown.length === 0) {
      continue;
    }
    views.push({
      sessionId,
      source: newest.source,
      mode: newest.mode,
      allowed: sessionRecords.filter((record) => record.verdict === 'allowed').length,
      denied: sessionRecords.filter((record) => record.verdict === 'denied').length,
      wouldDeny: sessionRecords.filter((record) => record.verdict === 'would-deny')
        .length,
      records: shown,
    });
  }

  if (filter.limit === undefined) {
    return views;
  }

  let remaining = filter.limit;
  const limited: DecisionSessionView[] = [];
  for (const view of views) {
    if (remaining <= 0) {
      break;
    }
    const records = view.records.slice(0, remaining);
    remaining -= records.length;
    limited.push({ ...view, records });
  }
  return limited;
}
