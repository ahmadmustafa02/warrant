import Link from 'next/link';
import { WarrantMark } from '@/components/brand/WarrantMark';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)]" data-reveal>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <WarrantMark />
          <p className="text-sm text-[var(--muted)]">
            Guard layer for agents you build — measured, sandboxed, mock side effects.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-semibold">
          <Link href="/playground" className="hover:opacity-60">
            Playground
          </Link>
          <Link href="/dashboard" className="hover:opacity-60">
            Lab
          </Link>
          <Link href="/method" className="hover:opacity-60">
            Method
          </Link>
          <Link href="/#install" className="hover:opacity-60">
            Install
          </Link>
          <a
            href="https://github.com/ahmadmustafa02/warrant"
            className="hover:opacity-60"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
