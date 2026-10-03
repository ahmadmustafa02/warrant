import Link from 'next/link';
import { Menu } from 'lucide-react';

const links = [
  { href: '/#product', label: 'Product' },
  { href: '/method', label: 'How it works' },
  { href: '/dashboard', label: 'Lab' },
  { href: '/playground', label: 'Playground' },
] as const;

function Spark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.5 13.4 10.6 22.5 12 13.4 13.4 12 22.5 10.6 13.4 1.5 12 10.6 10.6 12 1.5Z"
      />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header-shell sticky top-0 z-40 border-b border-white/10 bg-black/80 font-[family-name:var(--font-inter)] text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight"
        >
          <Spark />
          Warrant
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center text-sm text-white/75 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <details className="relative md:hidden">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-2 text-sm font-semibold">
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Menu</span>
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-white/10 bg-black p-2"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
          <a
            href="https://github.com/ahmadmustafa02/warrant"
            aria-label="GitHub"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-semibold sm:px-4"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 2.5-.34c.85 0 1.7.11 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
