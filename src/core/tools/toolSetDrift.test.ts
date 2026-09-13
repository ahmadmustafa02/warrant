import { describe, expect, it } from 'vitest';
import {
  detectToolSetDrift,
  driftedToolNames,
  establishToolSetBaseline,
} from './toolSetDrift';

const initial = [
  { name: 'read_document', parameterNames: ['id'] },
  { name: 'send_email', parameterNames: ['to', 'body'] },
];

describe('detectToolSetDrift', () => {
  it('reports nothing when the advertised set is unchanged', () => {
    const baseline = establishToolSetBaseline(initial);

    expect(detectToolSetDrift(baseline, initial)).toEqual([]);
  });

  it('ignores ordering and duplicate advertisements', () => {
    const baseline = establishToolSetBaseline(initial);
    const reordered = [
      { name: 'send_email', parameterNames: ['body', 'to'] },
      { name: 'read_document', parameterNames: ['id'] },
      { name: 'read_document', parameterNames: ['id'] },
    ];

    expect(detectToolSetDrift(baseline, reordered)).toEqual([]);
  });

  it('flags a capability that appears mid-session', () => {
    const baseline = establishToolSetBaseline(initial);
    const drifts = detectToolSetDrift(baseline, [
      ...initial,
      { name: 'export_records', parameterNames: ['url'] },
    ]);

    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.kind).toBe('NEW_TOOL');
    expect(drifts[0]?.toolName).toBe('export_records');
  });

  it('flags a known tool that gains a parameter', () => {
    const baseline = establishToolSetBaseline(initial);
    const drifts = detectToolSetDrift(baseline, [
      { name: 'read_document', parameterNames: ['id'] },
      { name: 'send_email', parameterNames: ['to', 'body', 'webhook_url'] },
    ]);

    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.kind).toBe('MUTATED_TOOL');
    expect(drifts[0]?.reason).toContain('webhook_url');
  });

  it('does not treat a removed parameter as drift', () => {
    const baseline = establishToolSetBaseline(initial);
    const drifts = detectToolSetDrift(baseline, [
      { name: 'read_document', parameterNames: ['id'] },
      { name: 'send_email', parameterNames: ['to'] },
    ]);

    expect(drifts).toEqual([]);
  });

  it('keeps flagging a new tool on every later turn', () => {
    const baseline = establishToolSetBaseline(initial);
    const poisoned = [...initial, { name: 'export_records', parameterNames: ['url'] }];

    expect(detectToolSetDrift(baseline, poisoned)).toHaveLength(1);
    expect(detectToolSetDrift(baseline, poisoned)).toHaveLength(1);
  });
});

describe('driftedToolNames', () => {
  it('collects the names a caller must refuse', () => {
    const baseline = establishToolSetBaseline(initial);
    const drifts = detectToolSetDrift(baseline, [
      ...initial,
      { name: 'export_records', parameterNames: ['url'] },
    ]);

    expect(driftedToolNames(drifts).has('export_records')).toBe(true);
    expect(driftedToolNames(drifts).has('read_document')).toBe(false);
  });
});
