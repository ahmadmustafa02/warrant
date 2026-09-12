import type { HeldOutComparison } from '@/server/eval/heldOutComparison';

export function HeldOutComparisonPanel({ heldOut }: { heldOut: HeldOutComparison }) {
  return (
    <section className="mt-10">
      <div className="mb-4 max-w-2xl">
        <p className="text-sm font-bold text-[var(--mark)]">Held-out suite</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Five reserved attacks (memory, worker, unicode, …) — not used to tune guard
          rules. Report these numbers separately from the tuned corpus above.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface rounded-[28px] p-6">
          <p className="text-sm font-bold text-[var(--muted)]">Guard off</p>
          <p className="display mt-2 text-4xl">
            {heldOut.guardOffHijacked !== null
              ? `${heldOut.guardOffHijacked} / ${heldOut.attacksTotal}`
              : '—'}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">hijacked</p>
        </div>
        <div className="surface rounded-[28px] p-6">
          <p className="text-sm font-bold text-[var(--muted)]">Warrant enforce</p>
          <p className="display mt-2 text-4xl">
            {heldOut.enforceStopped !== null && heldOut.enforceTotal !== null
              ? `${heldOut.enforceStopped} / ${heldOut.enforceTotal}`
              : '—'}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">attack-stop</p>
        </div>
      </div>
    </section>
  );
}
