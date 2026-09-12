import Link from 'next/link';
import { WarrantMark } from '@/components/brand/WarrantMark';

const links = [
  { href: '/dashboard', label: 'Lab' },
  { href: '/suites', label: 'Suites' },
  { href: '/method', label: 'Method' },
] as const;

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40">
      <div className="mx-auto flex min-h-[var(--header-h)] w-full max-w-6xl items-center justify-between gap-6 px-5">
        <Link
          href="/"
          className="pressable inline-flex min-h-11 items-center gap-2.5 text-[0.95rem] tracking-tight"
        >
          <WarrantMark className="h-7 w-7 text-[var(--accent)]" />
          <span className="font-medium">Warrant</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pressable inline-flex min-h-11 items-center rounded-full px-3 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="pressable ml-1 inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg)]"
          >
            Open lab
          </Link>
        </nav>
      </div>
    </header>
  );
}
