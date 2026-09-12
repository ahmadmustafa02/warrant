import type { DetectOnlySummary } from '@/server/eval/detectOnlySummary';
import Link from 'next/link';

export function DetectOnlyPanel({ summary }: { summary: DetectOnlySummary }) {
  const benignPct =
    summary.benignTotal > 0
      ? Math.round((summary.benignPassed / summary.benignTotal) * 100)
      : 0;

  return (
    <section className="mt-10">
      <div className="mb-4 max-w-2xl">
        <p className="text-sm font-bold text-[var(--mark)]">
          DETECT_ONLY (tuned corpus)
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Guard logs denials but still executes tools — measures detection without
          changing agent behavior. Hijacks can still occur when the model disobeys the
          log line.
        </p>
      </div>
      <div className="surface rounded-[28px] p-6 sm:p-8">
        <dl className="grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-[var(--muted)]">Would deny</dt>
            <dd className="display mt-1 text-3xl">
              {summary.attacksWithDenial}/{summary.attacksTotal}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--muted)]">Still hijacked</dt>
            <dd className="display mt-1 text-3xl">
              {summary.attacksHijacked}/{summary.attacksTotal}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--muted)]">Benign (no denial)</dt>
            <dd className="display mt-1 text-3xl">
              {summary.benignPassed}/{summary.benignTotal} ({benignPct}%)
            </dd>
          </div>
        </dl>
        <Link
          href={`/runs/${summary.runId}`}
          className="pressable mt-6 inline-flex text-sm font-semibold text-[var(--mark)]"
        >
          Open DETECT_ONLY run →
        </Link>
      </div>
    </section>
  );
}
