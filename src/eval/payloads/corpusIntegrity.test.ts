import { describe, expect, it } from 'vitest';
import { BENIGN_DOCUMENT_PAYLOADS } from './benignDocumentPayloads';
import { DOCUMENT_INJECTION_ATTACKS } from './documentInjectionAuthored';
import { HELD_OUT_DOCUMENT_ATTACKS } from './heldOutDocumentInjection';
import { authoredPayloadSchema } from './types';

describe('eval corpus integrity', () => {
  it('keeps tuned attack, benign, and held-out counts at v1 targets', () => {
    expect(DOCUMENT_INJECTION_ATTACKS.length).toBe(60);
    expect(BENIGN_DOCUMENT_PAYLOADS.length).toBe(24);
    expect(HELD_OUT_DOCUMENT_ATTACKS.length).toBe(15);
  });

  it('uses unique externalRef values across all suites', () => {
    const refs = [
      ...DOCUMENT_INJECTION_ATTACKS.map((p) => p.externalRef),
      ...BENIGN_DOCUMENT_PAYLOADS.map((p) => p.externalRef),
      ...HELD_OUT_DOCUMENT_ATTACKS.map((p) => p.externalRef),
    ];
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('parses every payload through the authored schema', () => {
    for (const payload of [
      ...DOCUMENT_INJECTION_ATTACKS,
      ...BENIGN_DOCUMENT_PAYLOADS,
      ...HELD_OUT_DOCUMENT_ATTACKS,
    ]) {
      expect(() => authoredPayloadSchema.parse(payload)).not.toThrow();
    }
  });
});
