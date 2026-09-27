import type { Metadata } from 'next';
import {
  queryDecisionSessions,
  readDecisionLog,
} from '@/cli/decisionLog/readDecisionLog';
import { resolveDecisionLogPath } from '@/cli/decisionLog/fileSink';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Decisions',
};

export const dynamic = 'force-dynamic';

function verdictClass(verdict: string): string {
  switch (verdict) {
    case 'denied':
      return 'text-[var(--mark)]';
    case 'would-deny':
      return 'text-[var(--muted)]';
    default:
      return 'text-[var(--ink)]';
  }
}

export default function DecisionsPage() {
  const path = resolveDecisionLogPath();
  const read = path === null ? { records: [], skipped: 0 } : readDecisionLog(path);
  const sessions = queryDecisionSessions(read.records, {
    sources: ['guard', 'scan'],
    limit: 200,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
      <p className="text-sm font-bold text-[var(--mark)]">Local log</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Decisions</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Every allow and deny from <span className="font-mono">warrant guard</span> and{' '}
        <span className="font-mono">warrant scan</span> on this machine. Tool arguments
        are not stored.
      </p>

      {sessions.length === 0 ? (
        <div className="surface mt-10 rounded-[var(--radius)] p-8">
          <h2 className="text-xl font-medium">No decisions yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Run an agent behind the guard. The next allow or deny will show up here.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl bg-[var(--surface-2)] p-4 font-mono text-sm">
            warrant guard -- &lt;your agent&gt;
          </pre>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {sessions.map((session) => (
            <li key={session.sessionId} className="surface rounded-[28px] p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="font-medium">
                  {session.source} · {session.mode}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {formatDateTime(session.records[0]?.at ?? '')}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                allowed {session.allowed} · denied {session.denied} · would-deny{' '}
                {session.wouldDeny}
              </p>
              <ul className="mt-4 space-y-2">
                {session.records.map((record, index) => (
                  <li key={`${record.at}-${record.tool}-${index}`}>
                    <details className="rounded-2xl bg-[var(--surface-2)] px-4 py-3">
                      <summary className="cursor-pointer text-sm">
                        <span className={verdictClass(record.verdict)}>
                          {record.verdict}
                        </span>
                        <span className="ml-2 font-mono">{record.tool}</span>
                        {record.code !== undefined ? (
                          <span className="ml-2 text-[var(--muted)]">
                            {record.code}
                          </span>
                        ) : null}
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {record.reason}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {record.riskTier ?? 'unclassified'} ·{' '}
                        {formatDateTime(record.at)}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {read.skipped > 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          {read.skipped} line(s) in the log were skipped because they were not valid
          records.
        </p>
      ) : null}
    </div>
  );
}
