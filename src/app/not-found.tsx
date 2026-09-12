import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-3xl flex-col justify-center px-5">
      <p className="text-sm font-bold text-[var(--mark)]">404</p>
      <h1 className="display mt-3 text-5xl">This page is not on the warrant.</h1>
      <Link
        href="/"
        className="pressable mt-8 inline-flex min-h-12 w-fit items-center rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-white"
      >
        Back to Warrant
      </Link>
    </div>
  );
}
