import type { Metadata } from 'next';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Red-team a sandbox agent: run document injection with guard off, then enable Warrant and watch the hijack get blocked.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-sm font-bold text-[var(--mark)]">Live red team</p>
      <h1 className="display mt-2 max-w-3xl text-4xl sm:text-5xl">
        Hijack this agent — then guard it.
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Pick a preset or paste your own injection. Run with guard off to see email and
        key exfiltration, then switch Warrant on and run the same attack again. Mock
        tools only; nothing leaves this sandbox.
      </p>
      <div className="mt-10">
        <PlaygroundPanel />
      </div>
    </div>
  );
}
