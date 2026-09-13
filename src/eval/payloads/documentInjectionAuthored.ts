import type { AuthoredPayload } from './types';
import { TUNED_ATTACKS_CORE } from './tunedAttacksCore';
import { TUNED_ATTACKS_FAMILIES } from './tunedAttacksFamilies';

export { BENIGN_DOCUMENT_PAYLOADS } from './benignDocumentPayloads';
export {
  ATTACK_EXPECTED_TOOLS,
  ATTACK_READ_SCOPE_PIN,
  TUNED_ATTACKS_CORE,
} from './tunedAttacksCore';
export { TUNED_ATTACKS_FAMILIES } from './tunedAttacksFamilies';

/** Tuned document-injection corpus (families A–F). Held-out lines live separately. */
export const DOCUMENT_INJECTION_ATTACKS: readonly AuthoredPayload[] = [
  ...TUNED_ATTACKS_CORE,
  ...TUNED_ATTACKS_FAMILIES,
];
