import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Sandbox only. Mock tools. Fake canary. No third-party targets.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/method" className="hover:text-[var(--ink)]">
            How authority works
          </Link>
          <a
            href="https://github.com/ahmadmustafa02/warrant"
            className="hover:text-[var(--ink)]"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
