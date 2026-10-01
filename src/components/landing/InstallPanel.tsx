import { PlaygroundTerminal } from '@/components/playground/PlaygroundTerminal';
import { CopyCommand } from '@/components/ui/CopyCommand';

const STEPS = [
  {
    n: '01',
    title: 'Install',
    body: 'The package is the CLI. This page only prints a recorded install log. Nothing is installed here.',
    command: 'npm install -g @warrant-lab/cli',
  },
  {
    n: '02',
    title: 'Scan',
    body: 'On their agent, scan plants a line in the tool result and reports attack-stop and benign-pass together. Add --adaptive for the tools that agent advertised, or --share for a link. warrant attack is a lab replay, not this step.',
    command: 'warrant scan -- node their-agent.js',
  },
  {
    n: '03',
    title: 'Guard',
    body: 'Same proxy, with the test line turned off. Leave this on. The permission is the person’s latest message.',
    command: 'warrant guard -- node their-agent.js',
  },
] as const;

export function InstallPanel() {
  return (
    <section
      id="install"
      className="reveal-section mx-auto w-full max-w-7xl scroll-mt-24 border-t border-white/10 px-5 py-24"
    >
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] lg:items-start lg:gap-12">
        <div className="reveal-copy lg:max-w-md xl:max-w-lg">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
            <span className="h-px w-8 bg-white/35" aria-hidden="true" />
            Drop it in
          </p>
          <h2 className="mt-6 text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            Install. Scan.
            <span className="text-[#a1a1aa]"> Guard.</span>
          </h2>
          <p className="mt-6 text-[15px] leading-7 font-normal text-white/55">
            This terminal replays recorded commands. On your machine the same CLI wraps
            the agent you already run: warrant scan, then warrant guard. Nothing here
            installs software or calls a live model.
          </p>

          <ol className="mt-8 space-y-5">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="font-mono text-xs tracking-[0.14em] text-[var(--muted)]">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 font-normal text-white/55">
                    {step.body}
                  </p>
                  <CopyCommand command={step.command} />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal-visual min-w-0 lg:translate-x-2 xl:translate-x-4">
          <PlaygroundTerminal />
        </div>
      </div>
    </section>
  );
}
