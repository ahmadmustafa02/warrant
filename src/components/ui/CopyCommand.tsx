'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [command]);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="pressable group mt-3 flex w-full max-w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-left shadow-sm transition-colors hover:border-[var(--mark)]/35 hover:bg-[var(--stage)]"
      aria-label={copied ? 'Copied to clipboard' : 'Copy command to clipboard'}
    >
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-[var(--ink)] sm:text-xs">
        {command}
      </code>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
          copied
            ? 'bg-[var(--safe-soft)] text-[var(--safe)]'
            : 'bg-[var(--stage)] text-[var(--muted)] group-hover:text-[var(--ink)]'
        }`}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </>
        )}
      </span>
    </button>
  );
}
