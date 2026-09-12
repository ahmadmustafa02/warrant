const SNIPPET = `import { ToolRegistry, issueWarrantFromExplicit } from '@warrant/guard';
import { evaluateToolCall } from '@warrant/guard/agent';

// 1. Describe your tools once.
const registry = new ToolRegistry([
  { name: 'read_ticket', riskTier: 'READ_ONLY', description: 'Read a ticket' },
  {
    name: 'wire_transfer',
    riskTier: 'DESTRUCTIVE',
    description: 'Move money',
    authorityParameters: ['to'],
  },
]);

// 2. Freeze what this turn authorized, before reading any content.
const warrant = issueWarrantFromExplicit(
  [{ tool: 'read_ticket', pinnedParameters: { id: 'T-1024' } }],
  registry,
);

// 3. Check every tool call your model proposes.
const decision = evaluateToolCall({
  mode: 'ENFORCE',
  warrant,
  registry,
  toolName,
  rawArguments,
});

if (decision && !decision.allowed) {
  return { role: 'tool', content: decision.reason };
}`;

export function InstallPanel() {
  return (
    <section id="install" className="mx-auto w-full max-w-6xl px-5 py-20 scroll-mt-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <p className="text-sm font-bold text-[var(--mark)]">Drop it in</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">Three steps, any agent.</h2>
          <p className="mt-4 text-[var(--muted)]">
            The guard is framework-free TypeScript with zero runtime dependencies. It
            works wherever your tool loop lives — OpenAI, Groq, or your own
            orchestrator.
          </p>

          <div className="surface mt-6 rounded-2xl border border-[var(--line)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Install
            </p>
            <code className="mt-2 block font-mono text-base">
              npm install @warrant/guard
            </code>
          </div>

          <p className="mt-3 text-sm text-[var(--muted)]">
            Not on the registry yet — until it lands, clone the repo and run{' '}
            <code className="font-mono">pnpm run build:guard</code>.
          </p>

          <a
            href="https://github.com/ahmadmustafa02/warrant/blob/main/docs/INTEGRATION.md"
            className="pressable mt-6 inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-semibold"
          >
            Read the integration guide
          </a>
        </div>

        <div className="surface overflow-hidden rounded-[28px] border border-[var(--line)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--hijack)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--blocked)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--safe)]" />
            <p className="ml-2 font-mono text-xs text-[var(--muted)]">agent.ts</p>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-6">
            {SNIPPET}
          </pre>
        </div>
      </div>
    </section>
  );
}
