import type { Metadata } from 'next';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Try document injection against the sandbox agent with guard off or Warrant enforce.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-sm font-bold text-[var(--mark)]">Interactive demo</p>
      <h1 className="display mt-2 max-w-3xl text-4xl sm:text-5xl">
        Attack the sandbox agent. Flip the guard.
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Same harness as the lab: mock email and API key, fake canary credential, Groq
        target model. Each run uses your server&apos;s API key and counts toward an
        hourly limit when deployed publicly.
      </p>
      <div className="mt-10">
        <PlaygroundPanel />
      </div>
    </div>
  );
}
