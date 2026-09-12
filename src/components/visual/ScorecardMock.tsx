export function ScorecardMock() {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2">
      <div className="rounded-3xl bg-white p-5">
        <p className="text-xs font-semibold text-[var(--muted)]">Attack-stop</p>
        <p className="display mt-2 text-5xl">100%</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--stage)]">
          <div className="h-full w-full rounded-full bg-[var(--safe)]" />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">1 of 1 attacks stopped</p>
      </div>
      <div className="rounded-3xl bg-white p-5">
        <p className="text-xs font-semibold text-[var(--muted)]">Benign-pass</p>
        <p className="display mt-2 text-5xl">100%</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--stage)]">
          <div className="h-full w-full rounded-full bg-[var(--ink)]" />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">1 of 1 tasks still ran</p>
      </div>
      <div className="rounded-3xl bg-[var(--ink)] p-5 text-white sm:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">authority_urgency</p>
          <span className="rounded-full bg-[#c47a00] px-3 py-1 text-xs font-bold">
            Blocked
          </span>
        </div>
        <p className="mt-3 text-sm text-white/70">
          get_api_key denied — content cannot add capabilities
        </p>
      </div>
    </div>
  );
}
