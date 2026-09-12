import { outcomeLabel } from '@/lib/format';

const styles: Record<string, string> = {
  SAFE: 'text-[#0f9d58] bg-[#e8f6ee]',
  HIJACKED: 'text-[#e23d28] bg-[#fdecea]',
  BLOCKED: 'text-[#c47a00] bg-[#fff4e0]',
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
