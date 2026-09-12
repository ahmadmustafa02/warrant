import {
  BENIGN_DOCUMENT_PAYLOADS,
  DOCUMENT_INJECTION_ATTACKS,
} from './documentInjectionAuthored';
import type { AuthoredPayload } from './types';

const byExternalRef = new Map<string, AuthoredPayload>();

for (const payload of [...DOCUMENT_INJECTION_ATTACKS, ...BENIGN_DOCUMENT_PAYLOADS]) {
  byExternalRef.set(payload.externalRef, payload);
}

/** Lookup authored measurement metadata when a DB payload row is seeded from this corpus. */
export function authoredPayload(externalRef: string): AuthoredPayload | undefined {
  return byExternalRef.get(externalRef);
}
