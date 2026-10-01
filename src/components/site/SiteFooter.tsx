import Link from 'next/link';
import { WarrantMark } from '@/components/brand/WarrantMark';

export function SiteFooter() {
  return (
    <footer
      className="border-t border-white/10 bg-black font-[family-name:var(--font-inter)] text-white"
      data-reveal
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <WarrantMark className="bg-white text-black" />
          <p className="text-sm font-normal text-white/55">
            A proxy in front of the agent you already run. Attack-stop and benign-pass,
            together.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-medium text-white/70">
          <Link href="/playground" className="hover:text-white">
            Playground
          </Link>
          <Link href="/dashboard" className="hover:text-white">
            Lab
          </Link>
          <Link href="/decisions" className="hover:text-white">
            Decisions
          </Link>
          <Link href="/method" className="hover:text-white">
            Method
          </Link>
          <Link href="/#install" className="hover:text-white">
            Install
          </Link>
          <a
            href="https://github.com/ahmadmustafa02/warrant"
            className="hover:text-white"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
