import { PlaygroundTerminal } from '@/components/playground/PlaygroundTerminal';

const STEPS = [
  {
    n: '01',
    title: 'Install',
    body: 'Run the demo install. Nothing is installed on your machine — the terminal prints a recorded log.',
    command: 'npm install -g @warrant/cli',
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
      className="reveal-section mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="reveal-copy">
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
                  <code className="mt-2 block font-mono text-xs text-[var(--ink)]">
                    {step.command}
                  </code>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal-visual min-w-0">
          <PlaygroundTerminal />
        </div>
      </div>
    </section>
  );
}
