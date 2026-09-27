import { describe, expect, it } from 'vitest';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import { buildProxyRegistry } from './classifyDiscoveredTool';
import { appendResponsesToolSecretsToTracker } from './ingestResponsesToolResults';

const registry = buildProxyRegistry(
  [
    {
      name: 'read_vault_entry',
      description: 'Read a vault secret',
      parameterNames: ['key'],
    },
    { name: 'read_document', description: 'Read a document', parameterNames: ['id'] },
  ],
  {},
);

describe('appendResponsesToolSecretsToTracker', () => {
  it('redacts a secret returned as function_call_output', () => {
    const tracker = new TurnSecretTracker();
    appendResponsesToolSecretsToTracker(
      tracker,
      {
        input: [
          { type: 'message', role: 'user', content: 'Summarize the ticket' },
          {
            type: 'function_call',
            call_id: 'call_vault',
            name: 'read_vault_entry',
            arguments: '{"key":"api"}',
          },
          {
            type: 'function_call_output',
            call_id: 'call_vault',
            output: JSON.stringify({ value: 'sk_live_ABC123456' }),
          },
        ],
      },
      registry,
    );

    const redacted = tracker.redactUnauthorizedInText(
      'The key is sk_live_ABC123456',
      [],
    );
    expect(redacted.text).toBe('The key is [REDACTED]');
  });

  it('leaves ordinary document text alone', () => {
    const tracker = new TurnSecretTracker();
    appendResponsesToolSecretsToTracker(
      tracker,
      {
        input: [
          {
            type: 'function_call',
            call_id: 'call_read',
            name: 'read_document',
            arguments: '{}',
          },
          {
            type: 'function_call_output',
            call_id: 'call_read',
            output: 'Revenue grew 12 percent',
          },
        ],
      },
      registry,
    );

    const redacted = tracker.redactUnauthorizedInText('Revenue grew 12 percent', []);
    expect(redacted.text).toBe('Revenue grew 12 percent');
    expect(redacted.redacted).toBe(false);
  });

  it('ignores a tool result whose call was not in this request', () => {
    const tracker = new TurnSecretTracker();
    appendResponsesToolSecretsToTracker(
      tracker,
      {
        input: [
          {
            type: 'function_call_output',
            call_id: 'missing',
            output: 'sk_live_ABC123456',
          },
        ],
      },
      registry,
    );
    expect(tracker.redactUnauthorizedInText('sk_live_ABC123456', []).redacted).toBe(
      false,
    );
  });
});
