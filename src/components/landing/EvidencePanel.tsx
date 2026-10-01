import { MeasuredComparisonPanel } from '@/components/lab/MeasuredComparisonPanel';
import type { MeasuredComparison } from '@/server/eval/baselineComparison';

/** Static fallback when the lab DB has no runs — keep in sync with README scorecards. */
const FALLBACK_ROWS = [
  {
    who: 'No guard',
    value: '17 / 60',
    detail: 'hijacked on the tuned suite · gpt-oss-20b · guard off',
    tone: 'hijack' as const,
  },
  {
    who: 'PromptGuard',
    value: 'Detect only',
    detail: 'llama-prompt-guard-2 flags a minority of lines · tools still fire',
    tone: 'blocked' as const,
  },
  {
    who: 'Warrant enforce',
    value: '100% stop',
    detail: '0 / 60 hijacked · 15/15 held-out · 22/24 benign pass',
    tone: 'safe' as const,
  },
];

const bar: Record<(typeof FALLBACK_ROWS)[number]['tone'], string> = {
  hijack: 'bg-[var(--hijack)]',
  blocked: 'bg-[var(--blocked)]',
  safe: 'bg-[var(--safe)]',
};

export function EvidencePanel({
  comparison,
}: {
  comparison: MeasuredComparison | null;
}) {
  if (comparison !== null && comparison.rows.length > 0) {
    return (
      <section className="reveal-section mx-auto w-full max-w-6xl border-t border-white/10 px-5 py-24">
        <div className="reveal-copy mb-10 max-w-3xl">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
            <span className="h-px w-8 bg-white/35" aria-hidden="true" />
            Same sandbox agent
          </p>
          <h2 className="mt-6 text-[clamp(2.2rem,4.2vw,3.4rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            Filters miss the hijacks that actually fire.
            <span className="text-[#a1a1aa]"> Authorization does not.</span>
          </h2>
        </div>
        <div className="reveal-visual">
          <MeasuredComparisonPanel comparison={comparison} compact />
        </div>
      </section>
    );
  }

  return (
    <section className="reveal-section mx-auto w-full max-w-6xl border-t border-white/10 px-5 py-24">
      <div className="reveal-visual overflow-hidden border border-white/15">
        <div className="reveal-copy border-b border-white/15 px-6 py-8 sm:px-8">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
            <span className="h-px w-8 bg-white/35" aria-hidden="true" />
            Same sandbox agent
          </p>
          <h2 className="mt-6 max-w-3xl text-[clamp(2.2rem,4.2vw,3.4rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            Filters miss the hijacks that actually fire.
            <span className="text-[#a1a1aa]"> Authorization does not.</span>
          </h2>
        </div>
        <ol className="grid sm:grid-cols-3">
          {FALLBACK_ROWS.map((row, index) => (
            <li
              key={row.who}
              className={`stat-card px-6 py-8 sm:px-8 ${
                index < FALLBACK_ROWS.length - 1
                  ? 'border-b border-[var(--line)] sm:border-b-0 sm:border-r'
                  : ''
              }`}
            >
              <span
                className={`reveal-bar mb-5 block h-1.5 w-10 rounded-full ${bar[row.tone]}`}
              />
              <p className="text-sm font-medium text-white/45">{row.who}</p>
              <p className="mt-3 text-4xl font-medium tracking-[-0.035em] sm:text-5xl">
                {row.value}
              </p>
              <p className="mt-2 text-sm font-normal text-white/55">{row.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
