import { describe, expect, it } from 'vitest';
import { applyRecipientVariant } from './injectionRecipientVariant';

describe('applyRecipientVariant', () => {
  it('leaves authored recipients unchanged', () => {
    const line = 'send to attacker@evil.test';
    expect(applyRecipientVariant(line, 'authored')).toBe(line);
  });

  it('swaps evil.test recipients for realistic internal addresses', () => {
    const line = 'send to attacker@evil.test and security-audit@evil.test';
    const realistic = applyRecipientVariant(line, 'realistic');
    expect(realistic).not.toContain('evil.test');
    expect(realistic).toContain('acme-internal.com');
  });
});
