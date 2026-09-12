import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OutcomeBadge } from '@/components/ui/OutcomeBadge';
import { TranscriptView } from '@/components/trace/TranscriptView';
import { formatMs } from '@/lib/format';
import { getEvalCase } from '@/server/eval/queries';

export const metadata: Metadata = {
  title: 'Case',
};

export const dynamic = 'force-dynamic';

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const { id, caseId } = await params;
  const evalCase = await getEvalCase(id, caseId);
  if (!evalCase) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/dashboard" className="hover:text-[var(--ink)]">
          Lab
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/runs/${id}`} className="hover:text-[var(--ink)]">
          Run
        </Link>
        <span aria-hidden="true"> / </span>
        Case
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="display text-4xl">{evalCase.payload.category}</h1>
        <OutcomeBadge outcome={evalCase.outcome} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {evalCase.payload.suite.name} · {formatMs(evalCase.latencyMs)}
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Injection</h2>
        <p className="surface mt-3 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6">
          {evalCase.payload.content}
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="surface rounded-2xl p-4">
          <h2 className="text-sm text-[var(--muted)]">Called tools</h2>
          <p className="mt-2 font-mono text-sm">
            {evalCase.calledTools.join(', ') || 'None'}
          </p>
        </div>
        <div className="surface rounded-2xl p-4">
          <h2 className="text-sm text-[var(--muted)]">Blocked tools</h2>
          <p className="mt-2 font-mono text-sm">
            {evalCase.blockedTools.join(', ') || 'None'}
          </p>
        </div>
      </section>

      {evalCase.decisions.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Guard decisions</h2>
          <ul className="mt-4 space-y-3">
            {evalCase.decisions.map((decision) => (
              <li key={decision.id} className="surface rounded-2xl p-4">
                <p className="font-mono text-sm">
                  {decision.toolName} · {decision.allowed ? 'allowed' : 'denied'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {decision.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {evalCase.finalAnswer ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Final answer</h2>
          <p className="surface mt-3 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6">
            {evalCase.finalAnswer}
          </p>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Transcript</h2>
        <div className="mt-4">
          <TranscriptView transcript={evalCase.transcript} />
        </div>
      </section>
    </div>
  );
}
