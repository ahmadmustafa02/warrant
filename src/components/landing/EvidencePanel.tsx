import { MeasuredComparisonPanel } from '@/components/lab/MeasuredComparisonPanel';
import type { MeasuredComparison } from '@/server/eval/baselineComparison';

/** Shown when the lab DB is empty — keep in sync with `pnpm run eval:*` workflow. */
const FALLBACK_ROWS = [
  {
    who: 'No guard',
    value: '8 / 12',
    detail: 'hijacked when the agent obeyed injected content · authored attack suite',
    tone: 'hijack' as const,
  },
  {
    who: 'PromptGuard',
    value: '2 / 12',
    detail: 'flagged only the loudest injections · threshold 0.5',
    tone: 'blocked' as const,
  },
  {
    who: 'Warrant',
    value: '0 / 12',
    detail: 'hijacked with enforce on · benign-pass 2/2 on the same agent',
    tone: 'safe' as const,
  },
];

const bar: Record<(typeof FALLBACK_ROWS)[number]['tone'], string> = {
  hijack: 'bg-[var(--hijack)]',
  blocked: 'bg-[var(--blocked)]',
  safe: 'bg-[var(--safe)]',
};

export function EvidencePanel({
  comparison,
}: {
  comparison: MeasuredComparison | null;
}) {
  if (comparison !== null && comparison.rows.length > 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="mb-6 max-w-2xl px-1 sm:px-3">
          <p className="text-sm font-bold text-[var(--mark)]">Same sandbox agent</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">
            Filters miss the hijacks that actually fire. Authorization does not.
          </h2>
        </div>
        <MeasuredComparisonPanel comparison={comparison} compact />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16">
      <div className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <p className="text-sm font-bold text-[var(--mark)]">Same sandbox agent</p>
          <h2 className="display mt-2 max-w-2xl text-3xl sm:text-4xl">
            Filters miss the hijacks that actually fire. Authorization does not.
          </h2>
        </div>
        <ol className="grid sm:grid-cols-3">
          {FALLBACK_ROWS.map((row, index) => (
            <li
              key={row.who}
              className={`stat-card px-6 py-8 sm:px-8 ${
                index < FALLBACK_ROWS.length - 1
                  ? 'border-b border-[var(--line)] sm:border-b-0 sm:border-r'
                  : ''
              }`}
            >
              <span className={`mb-5 block h-1.5 w-10 rounded-full ${bar[row.tone]}`} />
              <p className="text-sm font-bold text-[var(--muted)]">{row.who}</p>
              <p className="display mt-3 text-4xl sm:text-5xl">{row.value}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{row.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
