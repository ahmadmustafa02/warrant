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
