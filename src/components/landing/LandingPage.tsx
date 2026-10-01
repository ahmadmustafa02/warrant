import Image from 'next/image';
import Link from 'next/link';
import { BrowserFrame } from '@/components/visual/BrowserFrame';
import { DocumentMock } from '@/components/visual/DocumentMock';
import { ScorecardMock } from '@/components/visual/ScorecardMock';
import { TraceMock } from '@/components/visual/TraceMock';
import type { MeasuredComparison } from '@/server/eval/baselineComparison';
import { EvidencePanel } from './EvidencePanel';
import { InstallPanel } from './InstallPanel';
import { LandingMotion } from './LandingMotion';
import { ProductPath } from './ProductPath';

export function LandingPage({ comparison }: { comparison: MeasuredComparison | null }) {
  return (
    <LandingMotion>
      <section className="relative bg-black font-[family-name:var(--font-inter)] text-white">
        <div className="relative z-10 -mb-6 w-full bg-black">
          <div className="mx-auto flex w-full max-w-4xl translate-y-16 flex-col items-center px-5 pt-16 pb-8 text-center sm:pt-20">
            <p className="hero-line text-xs font-medium tracking-[0.28em] text-white/45 uppercase">
              Proxy guard · in front of the model
            </p>
            <h1 className="hero-line mx-auto mt-5 max-w-4xl text-[clamp(2.75rem,6.2vw,5.05rem)] leading-[1.02] font-medium tracking-[-0.035em]">
              Your agent can be hijacked. <span className="text-[#a1a1aa]">Guard</span>{' '}
              what it is allowed to do.
            </h1>
            <p className="hero-line mx-auto mt-5 max-w-2xl text-base leading-7 font-normal text-white/60">
              Warrant sits between the agent and the model. The permission is the
              person&apos;s latest message. A document, a page, or a tool result pasted
              into the next turn cannot add a send, a payment, or a new destination.
            </p>
            <div className="hero-line mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/method"
                className="pressable inline-flex min-h-12 items-center rounded-full border border-white/25 bg-black px-5 text-base font-medium"
              >
                How it works
              </Link>
              <Link
                href="/#install"
                className="pressable inline-flex min-h-12 items-center rounded-full border border-white/25 bg-black px-5 text-base font-medium"
              >
                Install
              </Link>
            </div>
          </div>
        </div>
        <div className="relative z-0 h-[40vw] w-full overflow-hidden">
          <Image
            src="/warrant-hero-background-hd.png"
            alt=""
            width={3072}
            height={2048}
            priority
            className="pointer-events-none absolute inset-x-0 top-0 h-auto w-full max-w-none select-none"
            style={{ transform: 'translateY(-42.5%)' }}
          />
        </div>
        <dl className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-y-8 px-5 py-10 sm:grid-cols-4">
          {[
            ['60', 'Attacks tested'],
            ['60', 'Stopped'],
            ['22/24', 'Benign'],
            ['15', 'Held-out'],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <dd className="text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                {value}
              </dd>
              <dt className="mt-2 text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-black px-5 pt-2 pb-16">
        <div className="hero-visual mx-auto w-full max-w-6xl">
          <div className="hero-visual-inner">
            <div className="hero-float">
              <BrowserFrame title="warrant.dev/dashboard">
                <ScorecardMock />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      <EvidencePanel comparison={comparison} />

      <section
        id="product"
        className="reveal-section scroll-mt-24 border-t border-white/10 px-5 py-24"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="reveal-copy">
            <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
              <span className="h-px w-8 bg-white/35" aria-hidden="true" />
              01 — The hijack
            </p>
            <h2 className="mt-6 max-w-xl text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
              The attack looks like
              <span className="text-[#a1a1aa]"> part of the job.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 font-normal text-white/55">
              The user asked for one thing. Somewhere in the content the agent reads,
              another instruction asks for something else — and the model treats both as
              work. No exploit chain, just text the agent was trained to follow.
            </p>
          </div>
          <div className="reveal-visual">
            <BrowserFrame title="doc-1 · Quarterly notes">
              <DocumentMock />
            </BrowserFrame>
          </div>
        </div>
      </section>

      <section className="reveal-section border-t border-white/10 px-5 py-24">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="reveal-visual lg:order-1">
            <BrowserFrame title="warrant.dev/runs/…/cases">
              <TraceMock />
            </BrowserFrame>
          </div>
          <div className="reveal-copy lg:order-2">
            <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
              <span className="h-px w-8 bg-white/35" aria-hidden="true" />
              02 — The guard
            </p>
            <h2 className="mt-6 max-w-xl text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
              Stop the hijack
              <span className="text-[#a1a1aa]"> at the tool call.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 font-normal text-white/55">
              The guard does not look for keywords. It checks the call against the last
              message the person wrote. An address from a document is refused. A secret
              inside a link is refused. A harmless new tool, such as one that only
              returns the answer, is allowed and saved. A risky new tool, or a tool that
              gains a field, waits until a person approves it. The original task still
              finishes.
            </p>
          </div>
        </div>
      </section>

      <section className="reveal-section border-t border-white/10 px-5 py-24">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="reveal-copy">
            <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
              <span className="h-px w-8 bg-white/35" aria-hidden="true" />
              03 — Their agent
            </p>
            <h2 className="mt-6 max-w-xl text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
              Scan it.
              <span className="text-[#a1a1aa]"> Then leave the guard on.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 font-normal text-white/55">
              You do not edit their code. The agent must send its model calls through
              Warrant. <span className="font-medium text-white">warrant scan</span>{' '}
              reads the tools that agent advertises and plants an attack in the tool
              result. Adaptive scan stops at the first shape the agent acts on.{' '}
              <span className="font-medium text-white">warrant scan --share</span>{' '}
              prints a link with the attack-stop rate and the benign-pass rate together.{' '}
              <span className="font-medium text-white">warrant guard</span> is the same
              proxy with the attack turned off.
            </p>
          </div>
          <div className="reveal-visual border border-white/15 p-6">
            <p className="font-mono text-xs tracking-[0.14em] text-white/45">
              On their machine
            </p>
            <ol className="mt-6 space-y-5 text-sm leading-6 text-white/70">
              <li>
                <span className="font-medium text-white">Scan.</span> Plant a line in
                what the tool returned. Report both rates.
              </li>
              <li>
                <span className="font-medium text-white">Adaptive.</span> Attack only
                the sensitive tools this agent actually advertised.
              </li>
              <li>
                <span className="font-medium text-white">Guard.</span> Every later call
                is checked against the person’s current message.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <InstallPanel />

      <ProductPath />

      <section className="reveal-section border-t border-white/10 px-5 py-28 text-center">
        <div className="reveal-copy mx-auto max-w-3xl">
          <h2 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            Try the hijack.
            <span className="text-[#a1a1aa]"> Then turn the guard on.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-7 font-normal text-white/55">
            Two runs in the playground say more than any claim about agent security.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/playground"
              className="pressable inline-flex min-h-12 items-center rounded-full border border-white/25 px-7 text-[15px] font-medium"
            >
              Open playground
            </Link>
            <Link
              href="/dashboard"
              className="pressable inline-flex min-h-12 items-center rounded-full border border-white/25 px-7 text-[15px] font-medium"
            >
              View measured runs
            </Link>
          </div>
        </div>
      </section>
    </LandingMotion>
  );
}
