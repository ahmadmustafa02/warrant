import Link from 'next/link';
import { BrowserFrame } from '@/components/visual/BrowserFrame';
import { DocumentMock } from '@/components/visual/DocumentMock';
import { ScorecardMock } from '@/components/visual/ScorecardMock';
import { TraceMock } from '@/components/visual/TraceMock';
import { EvidencePanel } from './EvidencePanel';
import { LandingMotion } from './LandingMotion';

export function LandingPage() {
  return (
    <LandingMotion>
      <section className="mx-auto w-full max-w-5xl px-5 pb-8 pt-16 text-center sm:pt-24">
        <p className="hero-line inline-flex rounded-full bg-[var(--stage)] px-3 py-1 text-sm font-semibold">
          Agent hijacking · tool-loop guard
        </p>
        <h1 className="display hero-line mx-auto mt-6 max-w-4xl text-5xl sm:text-7xl lg:text-[80px]">
          Hijacked agents leak keys and send mail.{' '}
          <span className="text-[var(--mark)]">Guard</span> yours.
        </h1>
        <p className="hero-line mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
          Instructions buried in a PDF, ticket, or web page can trick your model into
          calling real tools. Warrant sits in your agent loop, locks what the human
          authorized, and blocks every sensitive call that hijacked content tries to
          add.
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
              Your user asks for a two-sentence summary. Line three of the quarterly
              notes tells the model to email the sandbox API key to an ops inbox. No
              exploit chain — just text the agent was trained to follow.
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
              The model reached for get_api_key and send_email anyway. Warrant had
              already frozen the user&apos;s intent: read only. The exfiltration was
              denied; the summary still shipped.
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
            Attack your own sandbox agent, watch the hijack land with guard off, then
            prove Warrant stops it without breaking legitimate work.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Playground',
                body: 'Run a document injection live — guard off, then Warrant on.',
                href: '/playground',
              },
              {
                title: 'Lab',
                body: 'Stored runs with attack-stop and benign-pass on every scorecard.',
                href: '/dashboard',
              },
              {
                title: 'Suites',
                body: 'Ten hijack payloads plus benign tasks that must still succeed.',
                href: '/suites',
              },
              {
                title: 'Method',
                body: 'How we detect hijacks with facts, not another LLM verdict.',
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

      <section className="px-5 py-24 text-center">
        <h2 className="display mx-auto max-w-3xl text-4xl sm:text-6xl">
          Try the hijack. Then turn the guard on.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--muted)]">
          Two clicks in the playground beats a slide deck about agent security.
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
