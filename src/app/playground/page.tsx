import type { Metadata } from 'next';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'A recorded Warrant terminal: install, attack, and guard demos from seeded lab traces — no live model, no custom payloads.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <div data-reveal>
        <p className="text-sm font-bold text-[var(--mark)]">Recorded session</p>
        <h1 className="display mt-2 max-w-3xl text-4xl sm:text-5xl">
          The same CLI. Seeded outcomes.
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          This terminal only runs allowlisted demo commands. Attack and guard print
          stored lab traces — nothing installs on your machine, and you cannot type a
          custom prompt or payload.
        </p>
      </div>
      <div className="mt-10" data-reveal>
        <PlaygroundPanel />
      </div>
    </div>
  );
}
