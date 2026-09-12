import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-3xl flex-col justify-center px-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">404</p>
      <h1 className="display mt-4 text-5xl">This page is not on the warrant.</h1>
      <p className="mt-4 text-[var(--muted)]">
        The route does not exist, or the run has been removed.
      </p>
      <Link
        href="/"
        className="pressable mt-8 inline-flex min-h-12 w-fit items-center rounded-full bg-[var(--ink)] px-6 text-sm font-medium text-[var(--bg)]"
      >
        Back to Warrant
      </Link>
    </div>
  );
}
