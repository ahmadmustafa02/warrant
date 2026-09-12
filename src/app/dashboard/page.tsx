import type { Metadata } from 'next';
import Link from 'next/link';
import { MetricPair } from '@/components/ui/MetricPair';
import { formatDateTime, guardModeLabel } from '@/lib/format';
import { countEvalOverview, listEvalRuns } from '@/server/eval/queries';

export const metadata: Metadata = {
  title: 'Lab',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let runs: Awaited<ReturnType<typeof listEvalRuns>> = [];
  let overview: Awaited<ReturnType<typeof countEvalOverview>> | null = null;
  let loadError: string | null = null;

  try {
    [runs, overview] = await Promise.all([listEvalRuns(), countEvalOverview()]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : 'Could not load evaluation data';
  }

  const latestMetric = overview?.latest?.metric;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Lab</p>
      <h1 className="display mt-3 text-4xl sm:text-6xl">Measured runs</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Every completed run stores both rates. Open a row to inspect the cases, the
        tools that fired, and the warrant decisions.
      </p>

      {loadError ? (
        <div className="surface mt-10 rounded-[var(--radius)] p-8" role="alert">
          <h2 className="text-xl font-medium">Database is not reachable</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{loadError}</p>
          <p className="mt-3 font-mono text-sm text-[var(--ink)]">pnpm run db:up</p>
        </div>
      ) : null}

      {latestMetric ? (
        <div className="mt-10">
          <MetricPair
            size="lg"
            attackStopRate={latestMetric.attackStopRate}
            benignPassRate={latestMetric.benignPassRate}
            attacksStopped={latestMetric.attacksStopped}
            attacksTotal={latestMetric.attacksTotal}
            benignPassed={latestMetric.benignPassed}
            benignTotal={latestMetric.benignTotal}
          />
        </div>
      ) : null}

      {runs.length === 0 && !loadError ? (
        <div className="surface mt-10 rounded-[var(--radius)] p-8">
          <h2 className="text-xl font-medium">No runs yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Seed the authored suites, then run the combined scorecard. The first
            completed run will appear here with both rates.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl bg-[var(--surface-2)] p-4 font-mono text-sm">
            {`pnpm run eval:seed
pnpm run eval:full -- --guard ENFORCE`}
          </pre>
        </div>
      ) : null}

      {runs.length > 0 ? (
        <ul className="mt-10 space-y-3">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="pressable surface flex flex-col gap-3 rounded-[var(--radius)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{guardModeLabel(run.guardMode)}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {run.targetModelId} · {run._count.cases} cases ·{' '}
                    {formatDateTime(run.startedAt)}
                  </p>
                </div>
                {run.metric ? (
                  <p className="tabular text-sm text-[var(--ink)]">
                    Stop {Math.round(run.metric.attackStopRate * 100)}% · Pass{' '}
                    {Math.round(run.metric.benignPassRate * 100)}%
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{run.status}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
