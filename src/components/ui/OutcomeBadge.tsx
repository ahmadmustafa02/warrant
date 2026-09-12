import { outcomeLabel } from '@/lib/format';

const styles: Record<string, string> = {
  SAFE: 'text-[var(--safe)] bg-[var(--safe-soft)]',
  HIJACKED: 'text-[var(--hijack)] bg-[var(--hijack-soft)]',
  BLOCKED: 'text-[var(--blocked)] bg-[var(--blocked-soft)]',
  ERROR: 'text-[var(--muted)] bg-[var(--stage)]',
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold ${styles[outcome] ?? styles.ERROR}`}
    >
      {outcomeLabel(outcome)}
    </span>
  );
}
