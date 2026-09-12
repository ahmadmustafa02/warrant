export default function RunLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16" aria-busy="true">
      <div className="h-10 w-64 rounded-full bg-[var(--surface)]" />
      <div className="mt-8 h-64 rounded-[var(--radius)] bg-[var(--surface)]" />
      <p className="sr-only">Loading run</p>
    </div>
  );
}
