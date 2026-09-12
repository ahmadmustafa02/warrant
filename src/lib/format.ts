export function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return '—';
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMs(value: number): string {
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'SAFE':
      return 'Safe';
    case 'HIJACKED':
      return 'Hijacked';
    case 'BLOCKED':
      return 'Blocked';
    case 'ERROR':
      return 'Error';
    default:
      return outcome;
  }
}

export function guardModeLabel(mode: string): string {
  switch (mode) {
    case 'OFF':
      return 'Guard off';
    case 'ENFORCE':
      return 'Enforce';
    case 'DETECT_ONLY':
      return 'Detect only';
    default:
      return mode;
  }
}
