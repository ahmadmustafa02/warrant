import Link from 'next/link';
import { ArrowUpRight, FlaskConical, Layers, Play, Scale } from 'lucide-react';

const featured = {
  step: '01',
  title: 'Playground',
  body: 'Replay a recorded hijack, then the same attack with the guard on. On your own agent the commands are warrant scan, then warrant guard.',
  href: '/playground',
  cta: 'Open playground',
} as const;

const rest = [
  {
    step: '02',
    title: 'Lab',
    body: '60 of 60 tuned attacks stopped, with 22 of 24 normal tasks still passing. 15 of 15 held-out attacks stopped.',
    href: '/dashboard',
    icon: FlaskConical,
  },
  {
    step: '03',
    title: 'Suites',
    body: '60 attacks, 24 normal tasks, and 15 held-out attacks that were never used to tune the guard.',
    href: '/suites',
    icon: Layers,
  },
  {
    step: '04',
    title: 'Method',
    body: 'Permission is the current message. A hijack is what the tools did, not a model’s opinion.',
    href: '/method',
    icon: Scale,
  },
] as const;

export function ProductPath() {
  return (
    <section className="reveal-section border-t border-white/10 py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="reveal-copy max-w-3xl">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
            <span className="h-px w-8 bg-white/35" aria-hidden="true" />
            Where to go next
          </p>
          <h2 className="mt-6 text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            Scan your agent. Share the result.
            <span className="text-[#a1a1aa]"> Leave the guard on.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-7 font-normal text-white/55">
            Warrant tests an agent it never touched. LangChain and Vercel AI SDK agents
            ran unmodified: the hijack landed with the guard off, the guard stopped it,
            and the normal task still finished. Every result carries attack-stop next to
            benign-pass.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <Link
            href={featured.href}
            className="pressable group flex min-h-[260px] w-full flex-col justify-between border border-white/15 p-7 text-white sm:p-8 lg:w-1/2"
          >
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-white/45">
                {featured.step}
              </p>
              <div className="mt-6 inline-flex h-12 w-12 items-center justify-center border border-white/15">
                <Play className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-sm text-base leading-7 font-normal text-white/55">
                {featured.body}
              </p>
            </div>
            <span className="mt-10 inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              {featured.cta}
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>

          <div className="flex w-full flex-col gap-4 lg:w-1/2">
            {rest.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="pressable group flex flex-1 items-start gap-4 border border-white/15 p-5 text-white sm:p-6"
                >
                  <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/15">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--muted)]">
                          {item.step}
                        </span>
                        <h3 className="mt-1 text-xl font-medium tracking-tight">
                          {item.title}
                        </h3>
                      </span>
                      <ArrowUpRight
                        className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ink)]"
                        aria-hidden="true"
                      />
                    </span>
                    <p className="mt-2 text-sm leading-6 font-normal text-white/55">
                      {item.body}
                    </p>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
