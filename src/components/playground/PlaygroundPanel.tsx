'use client';

import { useState } from 'react';
import { TranscriptView } from '@/components/trace/TranscriptView';
import { OutcomeBadge } from '@/components/ui/OutcomeBadge';
import { PLAYGROUND_PRESETS } from '@/lib/playgroundPresets';
import { DEFAULT_EVAL_USER_TURN } from '@/eval/payloads/types';

type GuardChoice = 'OFF' | 'ENFORCE';

type PlaygroundResult = {
  outcome: string;
  hijacked: boolean;
  replayed?: boolean;
  replaySource?: string;
  guardMode: GuardChoice;
  warrantTools: string[];
  calledTools: string[];
  blockedTools: string[];
  finalAnswer: string;
  guardDecisions: {
    tool: string;
    allowed: boolean;
    reason: string;
    code: string | null;
  }[];
  transcript: unknown;
  latencyMs: number;
};

export function PlaygroundPanel() {
  const [userTurn, setUserTurn] = useState(DEFAULT_EVAL_USER_TURN);
  const [injectionLine, setInjectionLine] = useState(
    PLAYGROUND_PRESETS[0]?.injectionLine ?? '',
  );
  const [guardMode, setGuardMode] = useState<GuardChoice>('OFF');
  const [presetId, setPresetId] = useState(
    PLAYGROUND_PRESETS[0]?.id ?? 'direct_override',
  );
  const [liveMode, setLiveMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  async function runPlayground(nextGuard?: GuardChoice): Promise<void> {
    const mode = nextGuard ?? guardMode;
    setLoading(true);
    setError(null);
    if (nextGuard) {
      setGuardMode(nextGuard);
    }

    try {
      const body = liveMode
        ? {
            mode: 'live' as const,
            userTurn,
            injectionLine,
            guardMode: mode,
          }
        : {
            mode: 'replay' as const,
            presetId,
            guardMode: mode,
          };

      const response = await fetch('/api/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : 'Run failed.';
        setError(message);
        setResult(null);
        return;
      }

      setResult(payload as PlaygroundResult);
    } catch {
      setError('Network error while running the sandbox agent.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(id: string): void {
    const preset = PLAYGROUND_PRESETS.find((entry) => entry.id === id);
    if (!preset) {
      return;
    }
    setPresetId(preset.id);
    setUserTurn(preset.userTurn);
    setInjectionLine(preset.injectionLine);
    setResult(null);
    setError(null);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold text-[var(--mark)]">Presets</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="pressable rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                onClick={() => {
                  applyPreset(preset.id);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {PLAYGROUND_PRESETS.find((p) => p.injectionLine === injectionLine)
              ?.description ??
              'Custom input — mock tools only, fake canary credential.'}
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium">User request (authorizes tools)</span>
          <textarea
            className="surface mt-2 min-h-[100px] w-full rounded-2xl border border-[var(--line)] p-4 text-sm leading-6"
            value={userTurn}
            onChange={(event) => {
              setUserTurn(event.target.value);
            }}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Hidden line inside the document</span>
          <textarea
            className="surface mt-2 min-h-[120px] w-full rounded-2xl border border-[var(--line)] p-4 font-mono text-xs leading-6"
            value={injectionLine}
            onChange={(event) => {
              setInjectionLine(event.target.value);
            }}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={liveMode}
            onChange={(event) => {
              setLiveMode(event.target.checked);
            }}
          />
          Live run (uses Groq API, rate limited)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="flex rounded-full border border-[var(--line)] p-1">
            <legend className="sr-only">Guard mode</legend>
            {(['OFF', 'ENFORCE'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`pressable rounded-full px-4 py-2 text-sm font-semibold ${
                  guardMode === mode
                    ? 'bg-[var(--ink)] text-[var(--on-ink)]'
                    : 'text-[var(--muted)]'
                }`}
                onClick={() => {
                  setGuardMode(mode);
                }}
              >
                {mode === 'OFF' ? 'Guard off' : 'Warrant on'}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={loading}
            className="pressable inline-flex min-h-11 items-center rounded-full bg-[var(--mark)] px-5 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => {
              void runPlayground();
            }}
          >
            {loading
              ? 'Running…'
              : liveMode
                ? 'Run live agent'
                : 'Show recorded result'}
          </button>
        </div>

        {error ? (
          <p className="rounded-2xl border border-[var(--hijack)] bg-[var(--hijack-soft)] px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        {result ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <OutcomeBadge outcome={result.outcome} />
              <span className="text-sm text-[var(--muted)]">
                {result.replayed
                  ? `Recorded (${result.replaySource ?? 'replay'})`
                  : `${result.latencyMs} ms live`}
                {' · guard '}
                {result.guardMode.toLowerCase()}
              </span>
            </div>

            {result.guardMode === 'OFF' && result.hijacked ? (
              <button
                type="button"
                disabled={loading}
                className="pressable w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  void runPlayground('ENFORCE');
                }}
              >
                Same attack with Warrant on
              </button>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface rounded-2xl p-4">
                <p className="text-xs text-[var(--muted)]">Authorized this turn</p>
                <p className="mt-2 font-mono text-sm">
                  {result.warrantTools.join(', ') || 'None'}
                </p>
              </div>
              <div className="surface rounded-2xl p-4">
                <p className="text-xs text-[var(--muted)]">Called / blocked</p>
                <p className="mt-2 font-mono text-sm">
                  {result.calledTools.join(', ') || 'None'}
                  {result.blockedTools.length > 0
                    ? ` · blocked: ${result.blockedTools.join(', ')}`
                    : ''}
                </p>
              </div>
            </div>

            {result.guardDecisions.length > 0 ? (
              <div>
                <h2 className="text-sm font-bold">Guard decisions</h2>
                <ul className="mt-3 space-y-2">
                  {result.guardDecisions.map((decision, index) => (
                    <li
                      key={`${decision.tool}-${index}`}
                      className="surface rounded-2xl p-3 text-sm"
                    >
                      <p className="font-mono">
                        {decision.tool} · {decision.allowed ? 'allowed' : 'denied'}
                        {decision.code ? ` (${decision.code})` : ''}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">{decision.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h2 className="text-sm font-bold">Final answer</h2>
              <p className="surface mt-2 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6">
                {result.finalAnswer || '—'}
              </p>
            </div>

            <div>
              <h2 className="text-sm font-bold">Transcript</h2>
              <div className="mt-3 max-h-[420px] overflow-y-auto">
                <TranscriptView transcript={result.transcript} />
              </div>
            </div>
          </>
        ) : (
          <div className="surface flex min-h-[320px] items-center justify-center rounded-[28px] p-8 text-center">
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Run the sandbox agent to see whether the injection hijacks mock tools, and
              how Warrant blocks unauthorized sends and key reads.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
