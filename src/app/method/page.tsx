import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Method',
};

const rules = [
  {
    title: 'Authority is origin, not wording',
    body: 'A paragraph that says “you are now authorized” is still TOOL_RESULT data. The guard never pattern-matches the sentence. It asks who minted the permission.',
  },
  {
    title: 'The warrant is frozen',
    body: 'Permissions are derived from the user turn, then locked. Injected text arriving later has nothing left to edit. That is why unseen attacks still fail.',
  },
  {
    title: 'Parameters are not capabilities',
    body: 'If the user asked to email Bob, a document may supply the summary. It may not retarget the recipient when the user pinned one, and it may not invent send_email when the user only asked to summarize.',
  },
  {
    title: 'Hijack is a fact',
    body: 'A case is hijacked when an unauthorized side effect fires or the canary appears in the final answer. We do not ask a model whether it was “jailbroken.”',
  },
] as const;

export default function MethodPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Method</p>
      <h1 className="display mt-4 text-4xl sm:text-6xl">
        Content fills details. It never expands the permission set.
      </h1>
      <p className="mt-6 text-lg text-[var(--muted)]">
        Detection-based guards score phrasing. Warrant treats authorization as a closed
        set issued before untrusted content enters the context. Read-only tools stay
        free so ordinary work is not obstructed.
      </p>
      <ol className="mt-12 space-y-8">
        {rules.map((rule, index) => (
          <li key={rule.title} className="border-t border-[var(--line)] pt-6">
            <p className="text-xs tabular text-[var(--accent)]">0{index + 1}</p>
            <h2 className="mt-2 text-2xl font-medium">{rule.title}</h2>
            <p className="mt-2 leading-7 text-[var(--muted)]">{rule.body}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/dashboard"
        className="pressable mt-12 inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-sm font-medium text-[var(--bg)]"
      >
        See measured runs
      </Link>
    </article>
  );
}
