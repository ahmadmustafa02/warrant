import type { Metadata } from 'next';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Compare recorded lab runs: same injection with the guard off, then with Warrant enforcing tool authorization.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <div data-reveal>
        <p className="text-sm font-bold text-[var(--mark)]">Recorded lab runs</p>
        <h1 className="display mt-2 max-w-3xl text-4xl sm:text-5xl">
          Hijack this agent — then guard it.
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Choose a template and load recorded outcomes from the lab. Toggle guard off,
          then the same scenario with Warrant on to compare.
        </p>
      </div>
      <div className="mt-10" data-reveal>
        <PlaygroundPanel />
      </div>
    </div>
  );
}
