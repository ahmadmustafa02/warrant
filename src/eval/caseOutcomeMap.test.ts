import { describe, expect, it } from 'vitest';
import { toPrismaCaseOutcome } from './caseOutcomeMap';

describe('toPrismaCaseOutcome', () => {
  it('maps labels to prisma enum values', () => {
    expect(toPrismaCaseOutcome('HIJACKED')).toBe('HIJACKED');
    expect(toPrismaCaseOutcome('SAFE')).toBe('SAFE');
  });
});
