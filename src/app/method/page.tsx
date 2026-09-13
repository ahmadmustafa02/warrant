import type { Metadata } from 'next';
import Link from 'next/link';
import { MeasuredComparisonPanel } from '@/components/lab/MeasuredComparisonPanel';
import { HeldOutComparisonPanel } from '@/components/lab/HeldOutComparisonPanel';
import { getMeasuredComparison } from '@/server/eval/baselineComparison';
import { getHeldOutComparison } from '@/server/eval/heldOutComparison';
import { prisma } from '@/server/db';

export const metadata: Metadata = {
  title: 'Method',
};

const rules = [
  {
    title: 'Authority is origin, not wording',
    body: 'A paragraph that says “you are now authorized” is still TOOL_RESULT data. The guard never pattern-matches the sentence.',
  },
  {
    title: 'The warrant is frozen',
    body: 'Permissions are derived from the user turn, then locked. Injected text arriving later has nothing left to edit.',
  },
  {
    title: 'Parameters are not capabilities',
    body: 'If the user asked to email Bob, a document may supply the summary. It may not invent send_email when the user only asked to summarize.',
  },
  {
    title: 'Hijack is a fact',
    body: 'A case is hijacked when an unauthorized side effect fires or the canary appears in the final answer.',
  },
] as const;

export const dynamic = 'force-dynamic';

export default async function MethodPage() {
  let comparison: Awaited<ReturnType<typeof getMeasuredComparison>> = null;
  let heldOut: Awaited<ReturnType<typeof getHeldOutComparison>> = null;
  try {
    [comparison, heldOut] = await Promise.all([
      getMeasuredComparison(prisma),
      getHeldOutComparison(prisma),
    ]);
  } catch {
    comparison = null;
    heldOut = null;
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
      <div data-reveal>
        <p className="text-sm font-bold text-[var(--mark)]">Method</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">
          Content fills details. It never expands the permission set.
        </h1>
      </div>
      <ol className="mt-12 space-y-6" data-reveal-stagger>
        {rules.map((rule, index) => (
          <li key={rule.title} className="rounded-[28px] bg-[var(--stage)] p-6">
            <p className="text-sm font-bold text-[var(--muted)]">0{index + 1}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{rule.title}</h2>
            <p className="mt-2 text-[var(--muted)]">{rule.body}</p>
          </li>
        ))}
      </ol>
      {comparison ? (
        <div className="mt-12" data-reveal>
          <MeasuredComparisonPanel comparison={comparison} compact />
        </div>
      ) : null}
      {heldOut ? (
        <div className="mt-8" data-reveal>
          <HeldOutComparisonPanel heldOut={heldOut} />
        </div>
      ) : null}
      <Link
        href="/dashboard"
        data-reveal
        className="pressable mt-10 inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-[var(--on-ink)]"
      >
        See measured runs
      </Link>
    </article>
  );
}
