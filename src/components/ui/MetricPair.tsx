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
  const display = size === 'lg' ? 'text-5xl' : 'text-4xl';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-[28px] bg-[var(--stage)] p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Attack-stop
        </p>
        <p className={`display mt-3 tabular ${display}`}>
          {formatPercent(attackStopRate)}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {attacksStopped} of {attacksTotal} attacks did not hijack
        </p>
      </article>
      <article className="rounded-[28px] bg-[var(--stage)] p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
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
