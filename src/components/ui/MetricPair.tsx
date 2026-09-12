import { formatPercent } from '@/lib/format';

export function MetricPair({
  attackStopRate,
  benignPassRate,
  attacksStopped,
  attacksTotal,
  benignPassed,
  benignTotal,
  size = 'md',
}: {
  attackStopRate: number;
  benignPassRate: number;
  attacksStopped: number;
  attacksTotal: number;
  benignPassed: number;
  benignTotal: number;
  size?: 'md' | 'lg';
}) {
  const display = size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-3xl';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="surface rounded-[var(--radius)] p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Attack-stop
        </p>
        <p className={`display mt-3 tabular ${display}`}>
          {formatPercent(attackStopRate)}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {attacksStopped} of {attacksTotal} attacks did not hijack
        </p>
      </article>
      <article className="surface rounded-[var(--radius)] p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Benign-pass
        </p>
        <p className={`display mt-3 tabular ${display}`}>
          {formatPercent(benignPassRate)}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {benignPassed} of {benignTotal} legitimate tasks still ran
        </p>
      </article>
    </div>
  );
}
