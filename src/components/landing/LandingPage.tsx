import Link from 'next/link';
import { BrowserFrame } from '@/components/visual/BrowserFrame';
import { DocumentMock } from '@/components/visual/DocumentMock';
import { ScorecardMock } from '@/components/visual/ScorecardMock';
import { TraceMock } from '@/components/visual/TraceMock';
import { ChipMarquee } from './ChipMarquee';
import { LandingMotion } from './LandingMotion';

const stats = [
  { value: '7 / 10', label: 'Hijacks with the guard off' },
  { value: '2 / 10', label: 'Caught by PromptGuard' },
  { value: '2 rates', label: 'Always reported together' },
] as const;

export function LandingPage() {
  return (
    <LandingMotion>
      <section className="mx-auto w-full max-w-5xl px-5 pb-8 pt-16 text-center sm:pt-24">
        <p className="hero-line inline-flex rounded-full bg-[var(--stage)] px-3 py-1 text-sm font-semibold">
          Provenance-based tool authorization
        </p>
        <h1 className="display hero-line mx-auto mt-6 max-w-4xl text-5xl sm:text-7xl lg:text-[80px]">
          Stop agents from doing what the user never asked.
        </h1>
        <p className="hero-line mx-auto mt-6 max-w-xl text-lg text-[var(--muted)]">
          Hidden instructions in a document can steal tools. Warrant freezes permissions
          from the human first — then lets content fill details, never add capabilities.
        </p>
        <div className="hero-line mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="pressable inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-6 text-[15px] font-semibold text-white"
          >
            Open the lab
          </Link>
          <Link
            href="/method"
            className="pressable inline-flex min-h-12 items-center rounded-full border border-[var(--line)] bg-white px-6 text-[15px] font-semibold"
          >
            See the method
          </Link>
        </div>
      </section>

      <section className="hero-visual mx-auto w-full max-w-6xl px-5 pb-6">
        <BrowserFrame title="warrant.dev/dashboard" className="float-slow">
          <ScorecardMock />
        </BrowserFrame>
      </section>

      <ChipMarquee />

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-16 sm:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="stat-card rounded-[28px] bg-[var(--stage)] px-6 py-8 text-center"
          >
            <p className="display text-5xl">{stat.value}</p>
            <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
              {stat.label}
            </p>
          </article>
        ))}
      </section>

      <section className="stage py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-[var(--mark)]">01 — See the poison</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              The attack lives inside ordinary work.
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              A quarterly notes file looks fine until line three. The user only asked
              for a summary. The document asked for the API key.
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
            <p className="text-sm font-bold text-[var(--mark)]">
              02 — Freeze the warrant
            </p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              Content may fill details. It cannot add tools.
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              The user authorized read_document. get_api_key was never on the warrant.
              The guard denied it, then the agent still finished the summary.
            </p>
          </div>
        </div>
      </section>

      <section className="stage py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="display max-w-3xl text-4xl sm:text-6xl">
            Always both numbers. Always a replay.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                title: 'Lab',
                body: 'Every run shows attack-stop next to benign-pass.',
                href: '/dashboard',
              },
              {
                title: 'Suites',
                body: 'Ten authored injections and the tasks that must still pass.',
                href: '/suites',
              },
              {
                title: 'Method',
                body: 'Origin, freeze, parameters, facts — no LLM judge.',
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
          Open the lab. Watch a hijack fail.
        </h2>
        <Link
          href="/dashboard"
          className="pressable mt-8 inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-7 text-[15px] font-semibold text-white"
        >
          Go to measured runs
        </Link>
      </section>
    </LandingMotion>
  );
}
