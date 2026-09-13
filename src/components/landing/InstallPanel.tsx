import { PlaygroundTerminal } from '@/components/playground/PlaygroundTerminal';
import { CopyCommand } from '@/components/ui/CopyCommand';

const STEPS = [
  {
    n: '01',
    title: 'Install',
    body: 'Run the demo install. Nothing is installed on your machine — the terminal prints a recorded log.',
    command: 'npm install -g @warrant-lab/cli',
  },
  {
    n: '02',
    title: 'Red-team',
    body: 'On your machine: warrant red-team runs guard OFF then ENFORCE through the proxy. Here we replay a single attack with guard off.',
    command: 'warrant attack --payload task_disguise --guard OFF',
  },
  {
    n: '03',
    title: 'Guard',
    body: 'Same scenario with Warrant on — or wrap the demo agent. The block is recorded, not live.',
    command: 'warrant guard -- node agent.js',
  },
] as const;

export function InstallPanel() {
  return (
    <section
      id="install"
      className="reveal-section mx-auto w-full max-w-7xl scroll-mt-24 px-5 py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] lg:items-start lg:gap-12">
        <div className="reveal-copy lg:max-w-md xl:max-w-lg">
          <p className="text-sm font-bold text-[var(--mark)]">Drop it in</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">Install. Attack. Guard.</h2>
          <p className="mt-4 text-[var(--muted)]">
            Three allowlisted demos in the same terminal as the playground. No custom
            prompt, no live model — tap a chip or type a listed command.
          </p>

          <ol className="mt-8 space-y-5">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="font-mono text-xs tracking-[0.14em] text-[var(--muted)]">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
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
