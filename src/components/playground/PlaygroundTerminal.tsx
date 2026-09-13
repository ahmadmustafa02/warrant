'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  COMMAND_CHIPS,
  DOCTOR_LINES,
  EVAL_INTENT_LINES,
  HELP_LINES,
  INIT_LINES,
  INSTALL_LINES,
  parsePlaygroundCommand,
  suggestPlaygroundCommand,
  unknownCommandLines,
} from '@/lib/playgroundCommands';
import { formatAttackReplay, formatGuardReplay } from '@/lib/formatPlaygroundReplay';
import { isPlaygroundReplay } from '@/lib/isPlaygroundReplay';
import { PLAYGROUND_PRESETS } from '@/lib/playgroundPresets';

type LineTone = 'system' | 'cmd' | 'out' | 'ok' | 'warn' | 'err' | 'dim';

type TermLine = {
  readonly id: string;
  readonly tone: LineTone;
  readonly text: string;
};

const WELCOME: readonly TermLine[] = [
  {
    id: 'w1',
    tone: 'system',
    text: 'Warrant lab  ·  playground session',
  },
  {
    id: 'w2',
    tone: 'dim',
    text: 'Seeded traces only. Commands are allowlisted. Nothing installs or calls a model.',
  },
  {
    id: 'w3',
    tone: 'out',
    text: 'Type help, or tap a chip. Try attack off, then the same payload with enforce.',
  },
];

let termSeq = 0;

function nextTermId(prefix: string): string {
  termSeq += 1;
  return `${prefix}-${termSeq}`;
}

function toneClass(tone: LineTone): string {
  switch (tone) {
    case 'out':
      return 'text-[#c9d1d9]';
    case 'system':
      return 'text-[#79c0ff]';
    case 'cmd':
      return 'text-[#e6edf3]';
    case 'ok':
      return 'text-[#3fb950]';
    case 'warn':
      return 'text-[#d29922]';
    case 'err':
      return 'text-[#ff7b72]';
    case 'dim':
      return 'text-[#8b949e]';
  }
}

function linesToTerm(
  texts: readonly string[],
  tone: LineTone,
  prefix: string,
): TermLine[] {
  return texts.map((text, index) => ({
    id: `${prefix}-${index}-${text.slice(0, 12)}`,
    tone:
      text.startsWith('✔') || text.startsWith('Outcome: contained')
        ? 'ok'
        : text.startsWith('Outcome: hijacked') || text.startsWith('command not')
          ? 'err'
          : text.startsWith('Blocked:') || text.startsWith('deny')
            ? 'warn'
            : tone,
    text,
  }));
}

async function fetchReplay(
  presetId: string,
  guardMode: 'OFF' | 'ENFORCE',
): Promise<unknown> {
  const response = await fetch('/api/playground/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetId, guardMode }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Replay failed.';
    throw new Error(message);
  }
  return payload;
}

export function PlaygroundTerminal() {
  const inputId = useId();
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<TermLine[]>([...WELCOME]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [lines, busy]);

  function append(next: readonly TermLine[]): void {
    setLines((current) => [...current, ...next]);
  }

  async function runRaw(raw: string): Promise<void> {
    const parsed = parsePlaygroundCommand(raw);
    setError(null);

    if (parsed.kind === 'clear') {
      setLines([...WELCOME]);
      return;
    }

    append([
      {
        id: nextTermId('cmd'),
        tone: 'cmd',
        text: `$ ${raw.trim()}`,
      },
    ]);

    if (parsed.kind === 'unknown') {
      append(linesToTerm(unknownCommandLines(parsed.input), 'err', nextTermId('u')));
      setError('That command is not on the allowlist.');
      return;
    }

    if (parsed.kind === 'help') {
      append(linesToTerm(HELP_LINES, 'out', nextTermId('h')));
      return;
    }
    if (parsed.kind === 'install') {
      append(linesToTerm(INSTALL_LINES, 'out', nextTermId('i')));
      return;
    }
    if (parsed.kind === 'init') {
      append(linesToTerm(INIT_LINES, 'out', nextTermId('n')));
      return;
    }
    if (parsed.kind === 'doctor') {
      append(linesToTerm(DOCTOR_LINES, 'out', nextTermId('d')));
      return;
    }
    if (parsed.kind === 'eval-intent') {
      append(linesToTerm(EVAL_INTENT_LINES, 'out', nextTermId('e')));
      return;
    }

    setBusy(true);
    try {
      if (parsed.kind === 'attack') {
        const payload = await fetchReplay(parsed.presetId, parsed.guardMode);
        if (!isPlaygroundReplay(payload)) {
          throw new Error('Recorded run had an unexpected shape.');
        }
        append(
          linesToTerm(
            formatAttackReplay(parsed.presetId, payload),
            'out',
            nextTermId('a'),
          ),
        );
        return;
      }

      const payload = await fetchReplay('task_disguise', 'ENFORCE');
      if (!isPlaygroundReplay(payload)) {
        throw new Error('Recorded run had an unexpected shape.');
      }
      append(
        linesToTerm(
          formatGuardReplay(payload, parsed.detectOnly),
          'out',
          nextTermId('g'),
        ),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Replay failed.';
      setError(message);
      append(linesToTerm([message], 'err', nextTermId('x')));
    } finally {
      setBusy(false);
    }
  }

  function submitDraft(): void {
    if (busy) {
      return;
    }
    const value = draft.trim();
    if (value === '') {
      setError('Enter an allowlisted command, or tap a chip.');
      return;
    }
    setDraft('');
    void runRaw(value);
  }

  return (
    <div className="warrant-term overflow-hidden rounded-[28px] border border-[#21262d] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-3 border-b border-[#21262d] bg-[#161b22] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-[#8b949e]">
          playground@warrant — recorded session
        </p>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#3fb950] sm:block">
          replay
        </p>
      </div>

      <div className="border-b border-[#21262d] bg-[#0d1117] px-4 py-3">
        <p className="text-xs font-medium text-[#8b949e]">Scenarios</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLAYGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="pressable min-h-11 rounded-full border border-[#30363d] bg-[#161b22] px-3 text-xs font-medium text-[#c9d1d9] hover:border-[#58a6ff]"
              onClick={() => {
                setDraft(`warrant attack --payload ${preset.id} --guard OFF`);
                inputRef.current?.focus();
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="sr-only">
          Choosing a scenario fills an allowlisted attack command. Outcomes are
          recorded.
        </p>
      </div>

      <div
        ref={logRef}
        className="warrant-term-scan max-h-[min(62vh,560px)] min-h-[320px] overflow-y-auto bg-[#0d1117] px-4 py-4 font-mono text-[13px] leading-6 sm:text-sm"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.map((line) => (
          <p key={line.id} className={`whitespace-pre-wrap ${toneClass(line.tone)}`}>
            {line.text === '' ? ' ' : line.text}
          </p>
        ))}
        {busy ? (
          <p className="text-[#d29922]" aria-live="polite">
            replaying lab trace…
          </p>
        ) : null}
      </div>

      <div className="border-t border-[#21262d] bg-[#161b22] px-3 py-3 sm:px-4">
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Demo commands">
          {COMMAND_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={busy}
              title={chip.hint}
              className="pressable min-h-11 rounded-full border border-[#30363d] bg-[#0d1117] px-3 font-mono text-xs text-[#79c0ff] hover:border-[#58a6ff] disabled:opacity-50"
              onClick={() => {
                void runRaw(chip.command);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <label htmlFor={inputId} className="sr-only">
          Allowlisted playground command
        </label>
        <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#30363d] bg-[#0d1117] px-3 focus-within:border-[#58a6ff]">
          <span className="font-mono text-sm text-[#3fb950]" aria-hidden="true">
            $
          </span>
          <input
            ref={inputRef}
            id={inputId}
            value={draft}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            placeholder="warrant attack --payload task_disguise --guard OFF"
            className="min-h-11 w-full bg-transparent font-mono text-sm text-[#e6edf3] outline-none placeholder:text-[#484f58] disabled:opacity-50"
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const suggestion = suggestPlaygroundCommand(draft);
                if (suggestion !== undefined) {
                  event.preventDefault();
                  setDraft(suggestion);
                }
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                submitDraft();
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            className="pressable min-h-11 shrink-0 rounded-xl bg-[#238636] px-3 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              submitDraft();
            }}
          >
            Run
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-[#ff7b72]">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#8b949e]">
            Tab completes a matching chip. Unknown text is rejected.
          </p>
        )}
      </div>
    </div>
  );
}
