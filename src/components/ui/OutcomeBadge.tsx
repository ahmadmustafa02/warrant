import { outcomeLabel } from '@/lib/format';

const styles: Record<string, string> = {
  SAFE: 'text-[var(--safe)] bg-[color-mix(in_srgb,var(--safe)_14%,transparent)]',
  HIJACKED:
    'text-[var(--hijack)] bg-[color-mix(in_srgb,var(--hijack)_14%,transparent)]',
  BLOCKED: 'text-[var(--blocked)] bg-[var(--accent-soft)]',
  ERROR: 'text-[var(--muted)] bg-[var(--surface-2)]',
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium tracking-wide ${styles[outcome] ?? styles.ERROR}`}
    >
      {outcomeLabel(outcome)}
    </span>
  );
}
