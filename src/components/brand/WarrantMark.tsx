export function WarrantMark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[15px] font-extrabold tracking-tight text-[var(--on-ink)] ${className ?? ''}`}
      aria-hidden="true"
    >
      W
    </span>
  );
}
