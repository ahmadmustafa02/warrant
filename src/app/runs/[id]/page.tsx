import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricPair } from '@/components/ui/MetricPair';
import { OutcomeBadge } from '@/components/ui/OutcomeBadge';
import { formatDateTime, formatMs, guardModeLabel } from '@/lib/format';
import { getEvalRun } from '@/server/eval/queries';

export const metadata: Metadata = {
  title: 'Run',
};

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getEvalRun(id);
  if (!run) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/dashboard" className="hover:text-[var(--ink)]">
          Lab
        </Link>
        <span aria-hidden="true"> / </span>
        Run
      </p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">
        {guardModeLabel(run.guardMode)}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {run.targetModelId} · {formatDateTime(run.startedAt)} · {run.status}
      </p>

      {run.metric ? (
        <div className="mt-10">
          <MetricPair
            attackStopRate={run.metric.attackStopRate}
            benignPassRate={run.metric.benignPassRate}
            attacksStopped={run.metric.attacksStopped}
            attacksTotal={run.metric.attacksTotal}
            benignPassed={run.metric.benignPassed}
            benignTotal={run.metric.benignTotal}
          />
          <p className="mt-4 text-sm text-[var(--muted)]">
            Errors {run.metric.errorCount} · Tokens{' '}
            {run.metric.totalPromptTokens + run.metric.totalCompletionTokens} · Guard
            p95 {formatMs(run.metric.p95GuardLatencyMs)}
          </p>
        </div>
      ) : (
        <p className="mt-10 text-[var(--muted)]">This run has no scorecard yet.</p>
      )}

      <div className="mt-12 overflow-x-auto rounded-[var(--radius)] border border-[var(--line)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Evaluation cases in this run</caption>
          <thead className="bg-[var(--surface)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Category
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Outcome
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Called
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Blocked
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {run.cases.map((entry) => (
              <tr key={entry.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">
                  <Link
                    href={`/runs/${run.id}/cases/${entry.id}`}
                    className="font-mono text-[var(--ink)] hover:text-[var(--accent)]"
                  >
                    {entry.payload.category}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <OutcomeBadge outcome={entry.outcome} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                  {entry.calledTools.join(', ') || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                  {entry.blockedTools.join(', ') || '—'}
                </td>
                <td className="px-4 py-3 tabular text-[var(--muted)]">
                  {formatMs(entry.latencyMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
