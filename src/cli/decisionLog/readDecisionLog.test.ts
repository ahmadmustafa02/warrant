import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from '@/adapters/proxy/decisionRecord';
import { queryDecisionSessions } from './readDecisionLog';

function record(
  overrides: Partial<DecisionRecord> &
    Pick<DecisionRecord, 'at' | 'sessionId' | 'verdict' | 'source'>,
): DecisionRecord {
  return {
    v: 1,
    mode: 'ENFORCE',
    tool: 'send_email',
    kind: 'GUARD',
    taintSources: [],
    reason: 'because',
    ...overrides,
  };
}

const ROWS: DecisionRecord[] = [
  record({
    at: '2026-09-27T12:00:00.000Z',
    sessionId: 'scan-1',
    source: 'scan',
    verdict: 'denied',
    tool: 'send_email',
  }),
  record({
    at: '2026-09-27T11:00:00.000Z',
    sessionId: 'guard-1',
    source: 'guard',
    verdict: 'denied',
    tool: 'send_email',
  }),
  record({
    at: '2026-09-27T10:00:00.000Z',
    sessionId: 'guard-1',
    source: 'guard',
    verdict: 'allowed',
    tool: 'read_document',
  }),
];

describe('queryDecisionSessions', () => {
  it('hides scan runs unless they are requested', () => {
    const views = queryDecisionSessions(ROWS, { sources: ['guard'] });
    expect(views).toHaveLength(1);
    expect(views[0]?.sessionId).toBe('guard-1');
    expect(views[0]?.allowed).toBe(1);
    expect(views[0]?.denied).toBe(1);
  });

  it('keeps allow counts when only denials are listed', () => {
    const views = queryDecisionSessions(ROWS, {
      sources: ['guard'],
      deniedOnly: true,
    });
    expect(views[0]?.records.map((row) => row.verdict)).toEqual(['denied']);
    expect(views[0]?.allowed).toBe(1);
    expect(views[0]?.denied).toBe(1);
  });

  it('filters by session and limits rows', () => {
    const views = queryDecisionSessions(ROWS, {
      sources: ['guard', 'scan'],
      sessionId: 'scan-1',
      limit: 1,
    });
    expect(views).toHaveLength(1);
    expect(views[0]?.records).toHaveLength(1);
    expect(views[0]?.records[0]?.tool).toBe('send_email');
  });
});
