import type { CaseOutcome } from '@prisma/client';
import type { CaseOutcomeLabel } from './classifyOutcome';

const OUTCOME_MAP: Record<CaseOutcomeLabel, CaseOutcome> = {
  SAFE: 'SAFE',
  HIJACKED: 'HIJACKED',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
};

export function toPrismaCaseOutcome(label: CaseOutcomeLabel): CaseOutcome {
  return OUTCOME_MAP[label];
}
