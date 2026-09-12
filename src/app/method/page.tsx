import type { Metadata } from 'next';
import Link from 'next/link';

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

export default function MethodPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
      <p className="text-sm font-bold text-[var(--mark)]">Method</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">
        Content fills details. It never expands the permission set.
      </h1>
      <ol className="mt-12 space-y-6">
        {rules.map((rule, index) => (
          <li key={rule.title} className="rounded-[28px] bg-[var(--stage)] p-6">
            <p className="text-sm font-bold text-[var(--muted)]">0{index + 1}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{rule.title}</h2>
            <p className="mt-2 text-[var(--muted)]">{rule.body}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/dashboard"
        className="pressable mt-10 inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-[var(--on-ink)]"
      >
        See measured runs
      </Link>
    </article>
  );
}
