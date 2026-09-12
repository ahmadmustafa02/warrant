import type { Metadata } from 'next';
import { listSuitesWithPayloads } from '@/server/eval/queries';

export const metadata: Metadata = {
  title: 'Suites',
};

export const dynamic = 'force-dynamic';

export default async function SuitesPage() {
  let suites: Awaited<ReturnType<typeof listSuitesWithPayloads>> = [];
  let loadError: string | null = null;

  try {
    suites = await listSuitesWithPayloads();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Could not load suites';
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Suites</p>
      <h1 className="display mt-3 text-4xl sm:text-6xl">What we evaluate</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Authored document-injection attacks and the benign tasks that keep the guard
        honest. Held-out corpora stay held out.
      </p>

      {loadError ? (
        <p className="mt-10 text-sm text-[var(--hijack)]" role="alert">
          {loadError}
        </p>
      ) : null}

      {suites.length === 0 && !loadError ? (
        <p className="mt-10 text-[var(--muted)]">
          No suites loaded. Run <code className="font-mono">pnpm run eval:seed</code>.
        </p>
      ) : null}

      <div className="mt-10 space-y-10">
        {suites.map((suite) => (
          <section key={suite.id}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-medium">{suite.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {suite.kind === 'ATTACK' ? 'Attack' : 'Benign'} ·{' '}
                  {suite.isHeldOut ? 'Held out' : 'Authored'} · {suite.payloads.length}{' '}
                  payloads
                </p>
              </div>
            </div>
            <ul className="mt-5 divide-y divide-[var(--line)] rounded-[var(--radius)] border border-[var(--line)]">
              {suite.payloads.map((payload) => (
                <li key={payload.id} className="px-5 py-4">
                  <p className="font-mono text-sm">{payload.category}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                    {payload.content}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
