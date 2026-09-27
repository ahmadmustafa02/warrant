import { describe, expect, it } from 'vitest';
import { buildProxyRegistry } from './classifyDiscoveredTool';
import { deriveProxyIntent } from './deriveProxyIntent';

const registry = buildProxyRegistry([
  { name: 'read_ticket', description: '', parameterNames: ['id'] },
  { name: 'send_email', description: '', parameterNames: ['to', 'body'] },
  { name: 'refund_charge', description: '', parameterNames: ['amount', 'account'] },
]);

describe('deriveProxyIntent', () => {
  it('authorizes nothing consequential for a plain read request', () => {
    const intent = deriveProxyIntent('Summarize ticket 4412 for me', registry);

    expect(intent.requestedTools).toEqual([]);
  });

  it('authorizes a tool the user named through a synonym', () => {
    const intent = deriveProxyIntent('Email the summary to bob@corp.com', registry);

    expect(intent.requestedTools).toEqual(['send_email']);
  });

  it('pins the recipient the user stated', () => {
    const intent = deriveProxyIntent('Email the summary to bob@corp.com', registry);

    expect(intent.pinnedParameters?.['send_email']).toEqual({ to: 'bob@corp.com' });
  });

  it('does not authorize an unrelated destructive tool', () => {
    const intent = deriveProxyIntent('Email the summary to bob@corp.com', registry);

    expect(intent.requestedTools).not.toContain('refund_charge');
  });

  it('pins an amount the user stated', () => {
    const intent = deriveProxyIntent(
      'Refund the charge of $50 on that account',
      registry,
    );

    expect(intent.requestedTools).toContain('refund_charge');
    expect(intent.pinnedParameters?.['refund_charge']?.['amount']).toBe('50');
  });

  it('omits read-only tools because the guard exempts them by tier', () => {
    const intent = deriveProxyIntent('Read ticket 4412', registry);

    expect(intent.requestedTools).not.toContain('read_ticket');
  });
});

describe('deriveProxyIntent · document scope', () => {
  const docRegistry = buildProxyRegistry([
    { name: 'read_document', description: '', parameterNames: ['id'] },
    { name: 'send_email', description: '', parameterNames: ['to', 'body'] },
  ]);

  it('pins read_document when the user names a doc id', () => {
    const intent = deriveProxyIntent(
      'Please summarize document doc-1 for me in 2 sentences.',
      docRegistry,
    );

    expect(intent.requestedTools).toContain('read_document');
    expect(intent.pinnedParameters?.['read_document']).toEqual({ id: 'doc-1' });
  });
});

describe('deriveProxyIntent · recipient origin', () => {
  const mailRegistry = buildProxyRegistry([
    {
      name: 'send_email',
      description: '',
      parameterNames: ['to', 'cc', 'bcc', 'body'],
    },
  ]);

  it('pins cc and bcc separately from the main recipient', () => {
    const intent = deriveProxyIntent(
      'Email bob@corp.com and cc carol@corp.com and bcc dave@corp.com',
      mailRegistry,
    );

    expect(intent.pinnedParameters?.['send_email']).toEqual({
      to: 'bob@corp.com',
      cc: 'carol@corp.com',
      bcc: 'dave@corp.com',
    });
  });

  it('remembers a person when the user did not type an address', () => {
    const intent = deriveProxyIntent('Email Ali the summary', mailRegistry);

    expect(intent.requestedTools).toContain('send_email');
    expect(intent.pinnedParameters?.['send_email']).toBeUndefined();
    expect(intent.namedParties?.['send_email']).toEqual({ to: ['Ali'] });
  });

  it('pins send_to when that is the tool destination field', () => {
    const sendToRegistry = buildProxyRegistry([
      { name: 'send_email', description: '', parameterNames: ['send_to', 'body'] },
    ]);
    const intent = deriveProxyIntent(
      'Email the summary to bob@corp.com',
      sendToRegistry,
    );

    expect(intent.pinnedParameters?.['send_email']).toEqual({
      send_to: 'bob@corp.com',
    });
  });
});
