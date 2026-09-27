import { describe, expect, it } from 'vitest';
import type { ProxyDecision } from './guardExchange';
import {
  REASON_MAX_CHARS,
  toDecisionRecords,
  type DecisionLogContext,
} from './decisionRecord';

const CONTEXT: DecisionLogContext = {
  sessionId: 'session-1',
  source: 'guard',
  mode: 'ENFORCE',
  at: '2026-09-27T10:00:00.000Z',
};

const ALLOWED: ProxyDecision = {
  kind: 'GUARD',
  callId: 'call-read',
  decision: {
    allowed: true,
    tool: 'read_document',
    riskTier: 'READ_ONLY',
    authorizedBy: 'USER_WARRANT',
    taintSources: ['USER'],
    reason: 'The user turn covers read_document.',
  },
};

const DENIED: ProxyDecision = {
  kind: 'GUARD',
  callId: 'call-send',
  decision: {
    allowed: false,
    tool: 'send_email',
    riskTier: 'SENSITIVE',
    code: 'NO_WARRANT_FOR_TOOL',
    taintSources: ['TOOL_RESULT'],
    reason: 'The user turn does not authorize send_email.',
  },
};

describe('toDecisionRecords', () => {
  it('records an allow and a denial without copying arguments', () => {
    const records = toDecisionRecords([ALLOWED, DENIED], CONTEXT);
    expect(records.map((record) => record.verdict)).toEqual(['allowed', 'denied']);
    expect(records[1]).toMatchObject({
      tool: 'send_email',
      code: 'NO_WARRANT_FOR_TOOL',
      kind: 'GUARD',
      taintSources: ['TOOL_RESULT'],
    });
    expect(JSON.stringify(records)).not.toContain('attacker');
  });

  it('marks a detect-only denial as would-deny', () => {
    const [record] = toDecisionRecords([DENIED], { ...CONTEXT, mode: 'DETECT_ONLY' });
    expect(record?.verdict).toBe('would-deny');
    expect(record?.mode).toBe('DETECT_ONLY');
  });

  it('records malformed arguments and tool-set drift as denials', () => {
    const records = toDecisionRecords(
      [
        {
          kind: 'MALFORMED',
          callId: 'call-bad',
          toolName: 'send_email',
          reason: 'arguments were not valid JSON',
        },
        {
          kind: 'DRIFT',
          callId: 'call-drift',
          toolName: 'send_email',
          reason: 'advertised surface changed',
        },
      ],
      CONTEXT,
    );
    expect(records.map((record) => [record.kind, record.verdict, record.code])).toEqual(
      [
        ['MALFORMED', 'denied', undefined],
        ['DRIFT', 'denied', undefined],
      ],
    );
  });

  it('writes nothing when the guard is off', () => {
    expect(toDecisionRecords([DENIED], { ...CONTEXT, mode: 'OFF' })).toEqual([]);
  });

  it('truncates the reason and replaces a scan canary', () => {
    const canary = 'WARRANT-SCAN-CANARY-ABCDEF12';
    const [record] = toDecisionRecords(
      [
        {
          ...DENIED,
          decision: {
            allowed: false,
            tool: 'send_email',
            riskTier: 'SENSITIVE',
            code: 'NO_WARRANT_FOR_TOOL',
            taintSources: ['TOOL_RESULT'],
            reason: `${canary} ${'x'.repeat(REASON_MAX_CHARS)}`,
          },
        },
      ],
      { ...CONTEXT, source: 'scan', canary },
    );
    expect(record?.reason).toHaveLength(REASON_MAX_CHARS);
    expect(record?.reason.startsWith('[canary]')).toBe(true);
    expect(record?.reason).not.toContain(canary);
    expect(record?.source).toBe('scan');
  });
});
