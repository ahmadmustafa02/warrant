import type { ReactNode } from 'react';

export function BrowserFrame({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)] ${className}`}
    >
      <figcaption className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--stage)] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
          {title}
        </span>
      </figcaption>
      <div className="bg-[var(--stage)]">{children}</div>
    </figure>
  );
}
