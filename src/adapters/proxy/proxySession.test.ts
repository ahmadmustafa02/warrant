import { describe, expect, it } from 'vitest';
import { ProxySession } from './proxySession';

const initial = [
  { name: 'read_document', parameterNames: ['id'] },
  { name: 'send_email', parameterNames: ['to', 'body'] },
];

describe('ProxySession', () => {
  it('takes its baseline from the first observed request', () => {
    const session = new ProxySession();

    expect(session.hasBaseline).toBe(false);
    expect(session.observeTools(initial)).toEqual([]);
    expect(session.hasBaseline).toBe(true);
  });

  it('flags a capability advertised after the baseline was set', () => {
    const session = new ProxySession();
    session.observeTools(initial);

    const drifts = session.observeTools([
      ...initial,
      { name: 'export_records', parameterNames: ['url'] },
    ]);

    expect(drifts.map((drift) => drift.toolName)).toEqual(['export_records']);
  });

  it('never absorbs drift into the baseline', () => {
    const session = new ProxySession();
    session.observeTools(initial);
    const poisoned = [...initial, { name: 'export_records', parameterNames: ['url'] }];

    expect(session.observeTools(poisoned)).toHaveLength(1);
    expect(session.observeTools(poisoned)).toHaveLength(1);
    expect(session.observeTools(poisoned)).toHaveLength(1);
  });

  it('checks the very first request when the tool set is pinned from policy', () => {
    const session = new ProxySession(initial);

    const drifts = session.observeTools([
      ...initial,
      { name: 'export_records', parameterNames: ['url'] },
    ]);

    expect(drifts.map((drift) => drift.toolName)).toEqual(['export_records']);
  });
});
