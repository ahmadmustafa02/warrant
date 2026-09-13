import type { ReplayView } from '@/lib/formatPlaygroundReplay';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isPlaygroundReplay(value: unknown): value is ReplayView {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.outcome === 'string' &&
    typeof record.hijacked === 'boolean' &&
    (record.guardMode === 'OFF' || record.guardMode === 'ENFORCE') &&
    isStringArray(record.warrantTools) &&
    isStringArray(record.calledTools) &&
    isStringArray(record.blockedTools) &&
    typeof record.finalAnswer === 'string' &&
    Array.isArray(record.guardDecisions)
  );
}
