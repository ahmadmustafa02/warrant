import type { MeasuredComparison } from '@/server/eval/baselineComparison';

const barTone: Record<MeasuredComparison['rows'][number]['tone'], string> = {
  hijack: 'bg-[var(--hijack)]',
  blocked: 'bg-[var(--blocked)]',
  safe: 'bg-[var(--safe)]',
};

export function MeasuredComparisonPanel({
  comparison,
  compact = false,
}: {
  comparison: MeasuredComparison;
  compact?: boolean;
}) {
  return (
    <section className={compact ? '' : 'mt-10'}>
      {!compact ? (
        <div className="mb-4 max-w-2xl">
          <p className="text-sm font-bold text-[var(--mark)]">Measured comparison</p>
          <p className="mt-2 text-[var(--muted)]">
            Same authored document-injection suite: naive agent with guard off,
            published PromptGuard scores, and Warrant enforce with both rates reported.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <ol className={`grid ${comparison.rows.length > 1 ? 'sm:grid-cols-3' : ''}`}>
          {comparison.rows.map((row, index) => (
            <li
              key={row.id}
              className={`px-6 py-8 sm:px-8 ${
                index < comparison.rows.length - 1
                  ? 'border-b border-[var(--line)] sm:border-b-0 sm:border-r'
                  : ''
              }`}
            >
              <span
                className={`reveal-bar mb-5 block h-1.5 w-10 rounded-full ${barTone[row.tone]}`}
              />
              <p className="text-sm font-bold text-[var(--muted)]">{row.label}</p>
              <p className="display mt-3 text-4xl sm:text-5xl">{row.headline}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{row.detail}</p>
            </li>
          ))}
        </ol>
        {comparison.baselineScoredAt ? (
          <p className="border-t border-[var(--line)] px-6 py-3 text-xs text-[var(--muted)] sm:px-8">
            PromptGuard · {comparison.detectorModel} · threshold {comparison.threshold}
          </p>
        ) : null}
      </div>
    </section>
  );
}
