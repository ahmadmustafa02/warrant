import type { Metadata } from 'next';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'A recorded Warrant terminal. The live commands are warrant scan, then warrant guard. This page replays stored lab traces and does not call a model.',
};

export default function PlaygroundPage() {
  return (
    <div className="min-h-full bg-black font-[family-name:var(--font-inter)] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <div data-reveal>
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">
            <span className="h-px w-8 bg-white/35" aria-hidden="true" />
            Recorded session
          </p>
          <h1 className="mt-6 max-w-3xl text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.035em]">
            The same CLI.
            <span className="text-[#a1a1aa]"> Seeded outcomes.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 font-normal text-white/55">
            This terminal only replays allowlisted lab traces, including warrant attack,
            which is not the command you run on an agent. Nothing installs here, and you
            cannot type a custom prompt. On their machine the commands are warrant scan,
            then warrant guard.
          </p>
        </div>
        <div className="mt-10" data-reveal>
          <PlaygroundPanel />
        </div>
      </div>
    </div>
  );
}
