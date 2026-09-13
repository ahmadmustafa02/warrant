import Link from 'next/link';
import { WarrantMark } from '@/components/brand/WarrantMark';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const links = [
  { href: '/playground', label: 'Playground' },
  { href: '/dashboard', label: 'Lab' },
  { href: '/suites', label: 'Suites' },
  { href: '/method', label: 'Method' },
  { href: '/#install', label: 'Install' },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header-shell sticky top-0 z-40 px-4 pt-4">
      <div className="glass mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between rounded-full border border-[var(--line)] px-3 shadow-[var(--shadow)] sm:px-4">
        <Link
          href="/"
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-full px-2"
        >
          <WarrantMark />
          <span className="text-[15px] font-bold tracking-tight">Warrant</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pressable inline-flex min-h-11 items-center rounded-full px-3 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/playground"
            className="pressable inline-flex min-h-10 items-center rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--on-ink)]"
          >
            Try playground
          </Link>
        </div>
      </div>
    </header>
  );
}
