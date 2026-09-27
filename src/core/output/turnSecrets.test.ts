import { describe, expect, it } from 'vitest';
import { secretFragmentsFromToolResult, TurnSecretTracker } from './turnSecrets';

describe('secretFragmentsFromToolResult', () => {
  it('extracts a JSON value field', () => {
    const fragments = secretFragmentsFromToolResult(
      JSON.stringify({ key: 'api_key', value: 'WARRANT-CANARY-SECRET' }),
    );

    expect(fragments).toContain('WARRANT-CANARY-SECRET');
  });
});

describe('TurnSecretTracker', () => {
  it('redacts fragments from unauthorized secret tools', () => {
    const tracker = new TurnSecretTracker();
    tracker.recordToolResult(
      'read_vault_entry',
      JSON.stringify({ value: 'WARRANT-CANARY-SECRET' }),
      true,
    );

    const result = tracker.redactUnauthorizedInText(
      'Summary: the key is WARRANT-CANARY-SECRET',
      ['read_document'],
    );

    expect(result.redacted).toBe(true);
    expect(result.text).not.toContain('WARRANT-CANARY-SECRET');
    expect(result.text).toContain('[REDACTED]');
  });

  it('removes a secret that was retyped with spaces or dropped dashes', () => {
    const tracker = new TurnSecretTracker();
    tracker.recordToolResult(
      'read_vault_entry',
      JSON.stringify({ value: 'sk_live_ABC123456' }),
      true,
    );

    const spaced = tracker.redactUnauthorizedInText(
      'key s k _ l i v e _ A B C 1 2 3 4 5 6 end',
      [],
    );
    expect(spaced.text).toBe('key [REDACTED] end');

    const split = tracker.redactUnauthorizedInText('see sk live ABC123456 now', []);
    expect(split.text).toBe('see [REDACTED] now');
  });

  it('leaves ordinary document text that does not carry the secret', () => {
    const tracker = new TurnSecretTracker();
    tracker.recordToolResult('read_document', 'Revenue grew 12 percent', false);
    tracker.recordToolResult(
      'read_vault_entry',
      JSON.stringify({ value: 'sk_live_ABC123456' }),
      true,
    );

    const result = tracker.redactUnauthorizedInText('Revenue grew 12 percent', []);
    expect(result.redacted).toBe(false);
    expect(result.text).toBe('Revenue grew 12 percent');
  });

  it('leaves fragments when the user authorized that secret tool', () => {
    const tracker = new TurnSecretTracker();
    tracker.recordToolResult(
      'read_vault_entry',
      JSON.stringify({ value: 'WARRANT-CANARY-SECRET' }),
      true,
    );

    const result = tracker.redactUnauthorizedInText('Key: WARRANT-CANARY-SECRET', [
      'read_vault_entry',
    ]);

    expect(result.redacted).toBe(false);
    expect(result.text).toContain('WARRANT-CANARY-SECRET');
  });
});
