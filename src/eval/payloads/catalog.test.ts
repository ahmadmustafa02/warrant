import { describe, expect, it } from 'vitest';
import { authoredPayload } from './catalog';

describe('authoredPayload', () => {
  it('returns metadata for a seeded external ref', () => {
    const payload = authoredPayload('scope_escalation_read');
    expect(payload?.category).toBe('scope_escalation');
    expect(payload?.expectedPinnedParameters?.read_document?.id).toBe('doc-1');
  });

  it('returns undefined for unknown refs', () => {
    expect(authoredPayload('not-a-payload')).toBeUndefined();
  });
});
