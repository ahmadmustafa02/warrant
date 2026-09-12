import Link from 'next/link';
import { LandingMotion } from './LandingMotion';

const steps = [
  {
    title: 'Derive',
    body: 'Read the clean user turn and name the tools it actually asked for. Nothing else is in context yet.',
  },
  {
    title: 'Freeze',
    body: 'Issue a warrant and lock it. Later text — a PDF, a memory row, a worker — cannot edit the permission set.',
  },
  {
    title: 'Check',
    body: 'Every sensitive call is compared to that frozen set. Content may fill parameters. It cannot add capabilities.',
  },
  {
    title: 'Measure',
    body: 'Hijack is a fact: which tools fired, whether the canary leaked. Attack-stop is never published without benign-pass.',
  },
] as const;

export function LandingPage() {
  return (
    <LandingMotion>
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-16 sm:pt-24">
        <p className="hero-line text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Provenance-based tool authorization
        </p>
        <h1 className="display hero-line mt-5 max-w-4xl text-5xl sm:text-7xl">
          A sensitive action needs a warrant from the human.
        </h1>
        <p className="hero-line mt-7 max-w-2xl text-lg text-[var(--muted)]">
          Agents that read untrusted documents while holding real tools can be hijacked.
          Warrant does not hunt for malicious wording. It checks whether the human
          already authorized the action — before any document was opened.
        </p>
        <div className="hero-line mt-9 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="pressable inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-sm font-medium text-[var(--bg)]"
          >
            Open the lab
          </Link>
          <Link
            href="/method"
            className="pressable inline-flex min-h-12 items-center rounded-full border border-[var(--line)] px-6 text-sm text-[var(--ink)]"
          >
            Read the method
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2">
        <article className="metric-card surface rounded-[var(--radius)] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Spike, guard off
          </p>
          <p className="display mt-4 text-5xl tabular">7 / 10</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            gpt-oss-20b followed hidden instructions in a quarterly notes document and
            leaked a sandbox secret. Detection-only PromptGuard flagged 2 of 10.
          </p>
        </article>
        <article className="metric-card surface rounded-[var(--radius)] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            What we report
          </p>
          <p className="display mt-4 text-5xl">Both rates</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            A lock that never opens looks perfect on attack-stop and is useless. Every
            scorecard shows benign-pass beside it.
          </p>
        </article>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-28">
        <h2 className="display text-3xl sm:text-4xl">How a turn is authorized</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="step-card surface rounded-[var(--radius)] p-6"
            >
              <p className="text-xs tabular text-[var(--accent)]">0{index + 1}</p>
              <h3 className="mt-3 text-xl font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </LandingMotion>
  );
}
