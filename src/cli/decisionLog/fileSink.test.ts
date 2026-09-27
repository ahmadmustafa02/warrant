import { mkdtempSync } from 'node:fs';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProxyDecision } from '@/adapters/proxy/guardExchange';
import {
  createDecisionLogSink,
  resolveDecisionLogPath,
  rotatedDecisionLogPath,
} from './fileSink';
import { readDecisionLog } from './readDecisionLog';

const DENIED: ProxyDecision = {
  kind: 'GUARD',
  callId: 'call-send',
  decision: {
    allowed: false,
    tool: 'send_email',
    riskTier: 'SENSITIVE',
    code: 'NO_WARRANT_FOR_TOOL',
    taintSources: ['TOOL_RESULT'],
    reason: 'not authorized',
  },
};

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'warrant-log-'));
}

describe('createDecisionLogSink', () => {
  it('appends a valid line', () => {
    const path = join(tempDir(), 'decisions.ndjson');
    const sink = createDecisionLogSink({
      path,
      sessionId: 's1',
      now: () => new Date('2026-09-27T10:00:00.000Z'),
    });
    sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'guard' });

    const read = readDecisionLog(path);
    expect(read.skipped).toBe(0);
    expect(read.records).toHaveLength(1);
    expect(read.records[0]).toMatchObject({
      sessionId: 's1',
      tool: 'send_email',
      verdict: 'denied',
    });
  });

  it('rotates once the file passes the size limit', () => {
    const path = join(tempDir(), 'decisions.ndjson');
    const sink = createDecisionLogSink({
      path,
      maxBytes: 80,
      sessionId: 's1',
      now: () => new Date('2026-09-27T10:00:00.000Z'),
    });
    sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'guard' });
    sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'guard' });

    expect(statSync(rotatedDecisionLogPath(path)).size).toBeGreaterThan(0);
    const read = readDecisionLog(path);
    expect(read.records.length).toBeGreaterThanOrEqual(2);
  });

  it('warns once and does not throw when the path cannot be written', () => {
    const dir = tempDir();
    const blocker = join(dir, 'not-a-directory');
    writeFileSync(blocker, 'x');
    const warnings: string[] = [];
    const sink = createDecisionLogSink({
      path: join(blocker, 'decisions.ndjson'),
      warn: (message) => warnings.push(message),
    });

    expect(() =>
      sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'guard' }),
    ).not.toThrow();
    expect(() =>
      sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'guard' }),
    ).not.toThrow();
    expect(warnings).toHaveLength(1);
  });
});

describe('resolveDecisionLogPath', () => {
  it('turns off when WARRANT_DECISION_LOG=off', () => {
    expect(resolveDecisionLogPath({ WARRANT_DECISION_LOG: 'off' }, '/work')).toBeNull();
    expect(createDecisionLogSink({ env: { WARRANT_DECISION_LOG: 'off' } })).toBeNull();
  });

  it('uses the given path and otherwise the working directory', () => {
    expect(resolveDecisionLogPath({ WARRANT_DECISION_LOG: 'custom.ndjson' })).toBe(
      'custom.ndjson',
    );
    expect(resolveDecisionLogPath({}, '/work')).toBe(
      join('/work', '.warrant', 'decisions.ndjson'),
    );
  });
});

describe('readDecisionLog', () => {
  it('skips malformed and wrong-version lines and returns newest first', () => {
    const path = join(tempDir(), 'decisions.ndjson');
    const sink = createDecisionLogSink({
      path,
      sessionId: 'new',
      now: () => new Date('2026-09-27T12:00:00.000Z'),
    });
    writeFileSync(
      path,
      [
        JSON.stringify({
          v: 1,
          at: '2026-09-27T09:00:00.000Z',
          sessionId: 'old',
          source: 'guard',
          mode: 'ENFORCE',
          tool: 'read_document',
          verdict: 'allowed',
          kind: 'GUARD',
          authorizedBy: 'RISK_TIER',
          taintSources: [],
          reason: 'read',
        }),
        'not-json',
        JSON.stringify({ v: 2, tool: 'send_email' }),
        '',
      ].join('\n') + '\n',
    );
    sink?.append({ decisions: [DENIED], mode: 'ENFORCE', source: 'scan' });

    const read = readDecisionLog(path);
    expect(read.skipped).toBe(2);
    expect(read.records.map((record) => record.sessionId)).toEqual(['new', 'old']);
    expect(readFileSync(path, 'utf8').length).toBeGreaterThan(0);
  });
});
