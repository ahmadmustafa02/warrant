import Link from 'next/link';
import { BrowserFrame } from '@/components/visual/BrowserFrame';
import { DocumentMock } from '@/components/visual/DocumentMock';
import { ScorecardMock } from '@/components/visual/ScorecardMock';
import { TraceMock } from '@/components/visual/TraceMock';
import { EvidencePanel } from './EvidencePanel';
import { InstallPanel } from './InstallPanel';
import { LandingMotion } from './LandingMotion';

export function LandingPage() {
  return (
    <LandingMotion>
      <section className="mx-auto w-full max-w-5xl px-5 pb-8 pt-16 text-center sm:pt-24">
        <p className="hero-line inline-flex rounded-full bg-[var(--stage)] px-3 py-1 text-sm font-semibold">
          Agent hijacking · tool-loop guard
        </p>
        <h1 className="display hero-line mx-auto mt-6 max-w-4xl text-5xl sm:text-7xl lg:text-[80px]">
          Your agent can be hijacked. <span className="text-[var(--mark)]">Guard</span>{' '}
          what it is allowed to do.
        </h1>
        <p className="hero-line mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
          Content your agent reads can carry instructions of its own. Warrant sits in
          your tool loop, locks in what the user actually authorized, and denies any
          action the hijacked content tries to add.
        </p>
        <div className="hero-line mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/playground"
            className="pressable inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-[15px] font-semibold text-[var(--on-ink)]"
          >
            Try the playground
          </Link>
          <Link
            href="/method"
            className="pressable inline-flex min-h-12 items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 text-[15px] font-semibold"
          >
            How it works
          </Link>
        </div>
      </section>

      <section className="hero-visual mx-auto w-full max-w-6xl px-5 pb-6">
        <BrowserFrame title="warrant.dev/dashboard" className="float-slow">
          <ScorecardMock />
        </BrowserFrame>
      </section>

      <EvidencePanel />

      <section className="stage py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-[var(--mark)]">01 — The hijack</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              The attack looks like part of the job.
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              The user asked for one thing. Somewhere in the content the agent reads,
              another instruction asks for something else — and the model treats both as
              work. No exploit chain, just text the agent was trained to follow.
            </p>
          </div>
          <BrowserFrame title="doc-1 · Quarterly notes">
            <DocumentMock />
          </BrowserFrame>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
          <BrowserFrame title="warrant.dev/runs/…/cases" className="lg:order-1">
            <TraceMock />
          </BrowserFrame>
          <div className="lg:order-2">
            <p className="text-sm font-bold text-[var(--mark)]">02 — The guard</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              Stop the hijack at the tool call.
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Nothing has to detect the wording. The action was simply never authorized,
              so the guard denies it — and the agent still completes the job the user
              asked for.
            </p>
          </div>
        </div>
      </section>

      <section className="stage py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="display max-w-3xl text-4xl sm:text-6xl">
            Red-team it. Measure it. Ship the guard.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            Attack an agent, watch the hijack land with the guard off, then prove the
            guard stops it without breaking legitimate work.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Playground',
                body: 'Hijack a live agent, then run the same attack with the guard on.',
                href: '/playground',
              },
              {
                title: 'Lab',
                body: 'Stored runs with attack-stop and benign-pass on every scorecard.',
                href: '/dashboard',
              },
              {
                title: 'Suites',
                body: 'Hijack payloads next to the ordinary tasks that must still work.',
                href: '/suites',
              },
              {
                title: 'Method',
                body: 'Why a hijack is decided by what happened, not by a model verdict.',
                href: '/method',
              },
            ].map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="pressable lift surface block rounded-[28px] p-6"
              >
                <h3 className="text-2xl font-bold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-[var(--muted)]">{card.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <InstallPanel />

      <section className="px-5 py-24 text-center">
        <h2 className="display mx-auto max-w-3xl text-4xl sm:text-6xl">
          Try the hijack. Then turn the guard on.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--muted)]">
          Two runs in the playground say more than any claim about agent security.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/playground"
            className="pressable inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-7 text-[15px] font-semibold text-[var(--on-ink)]"
          >
            Open playground
          </Link>
          <Link
            href="/dashboard"
            className="pressable inline-flex min-h-12 items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-7 text-[15px] font-semibold"
          >
            View measured runs
          </Link>
        </div>
      </section>
    </LandingMotion>
  );
}
