export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16" aria-busy="true">
      <div className="h-10 w-48 rounded-full bg-[var(--surface)]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-[var(--radius)] bg-[var(--surface)]" />
        <div className="h-40 rounded-[var(--radius)] bg-[var(--surface)]" />
      </div>
      <p className="sr-only">Loading evaluation runs</p>
    </div>
  );
}
