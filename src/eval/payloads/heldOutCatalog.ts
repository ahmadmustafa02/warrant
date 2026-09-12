import { HELD_OUT_DOCUMENT_ATTACKS } from './heldOutDocumentInjection';
import type { AuthoredPayload } from './types';

const byExternalRef = new Map<string, AuthoredPayload>();

for (const payload of HELD_OUT_DOCUMENT_ATTACKS) {
  byExternalRef.set(payload.externalRef, payload);
}

export function heldOutPayload(externalRef: string): AuthoredPayload | undefined {
  return byExternalRef.get(externalRef);
}
