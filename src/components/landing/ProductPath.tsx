import Link from 'next/link';
import { ArrowUpRight, FlaskConical, Layers, Play, Scale } from 'lucide-react';

const featured = {
  step: '01',
  title: 'Playground',
  body: 'Replay a recorded hijack. Then the same attack with Warrant on.',
  href: '/playground',
  cta: 'Open playground',
} as const;

const rest = [
  {
    step: '02',
    title: 'Lab',
    body: 'Completed runs with attack-stop and benign-pass on every scorecard.',
    href: '/dashboard',
    icon: FlaskConical,
  },
  {
    step: '03',
    title: 'Suites',
    body: 'Hijack payloads next to the ordinary tasks that must still work.',
    href: '/suites',
    icon: Layers,
  },
  {
    step: '04',
    title: 'Method',
    body: 'A hijack is decided by what happened — not by a model verdict.',
    href: '/method',
    icon: Scale,
  },
] as const;

export function ProductPath() {
  return (
    <section className="stage reveal-section py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="reveal-copy max-w-3xl">
          <p className="text-sm font-bold text-[var(--mark)]">Where to go next</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight leading-[1.08] sm:text-5xl">
            Red-team it. Measure it.
            <br />
            Ship the guard.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-7 text-[var(--muted)]">
            Watch a hijack land with the guard off, then prove Warrant stops it without
            breaking legitimate work.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <Link
            href={featured.href}
            className="pressable group flex min-h-[260px] w-full flex-col justify-between rounded-[32px] bg-[var(--ink)] p-7 text-[var(--on-ink)] sm:p-8 lg:w-1/2"
          >
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-[var(--on-ink)]/55">
                {featured.step}
              </p>
              <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--on-ink)]/10">
                <Play className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-sm text-base leading-7 text-[var(--on-ink)]/70">
                {featured.body}
              </p>
            </div>
            <span className="mt-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
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
                  className="pressable group surface flex flex-1 items-start gap-4 rounded-[28px] p-5 sm:p-6"
                >
                  <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--stage)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--muted)]">
                          {item.step}
                        </span>
                        <h3 className="mt-1 text-xl font-bold tracking-tight">
                          {item.title}
                        </h3>
                      </span>
                      <ArrowUpRight
                        className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ink)]"
                        aria-hidden="true"
                      />
                    </span>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
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
