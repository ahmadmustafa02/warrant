import { PLAYGROUND_PRESETS } from '@/lib/playgroundPresets';

export type ReplayView = {
  readonly outcome: string;
  readonly hijacked: boolean;
  readonly guardMode: 'OFF' | 'ENFORCE';
  readonly warrantTools: readonly string[];
  readonly calledTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly finalAnswer: string;
  readonly guardDecisions: readonly {
    readonly tool: string;
    readonly allowed: boolean;
    readonly reason: string;
    readonly code: string | null;
  }[];
  readonly replaySource?: string;
};

export function formatAttackReplay(
  presetId: string,
  replay: ReplayView,
): readonly string[] {
  const preset = PLAYGROUND_PRESETS.find((entry) => entry.id === presetId);
  const outcome =
    replay.outcome === 'HIJACKED'
      ? 'Outcome: hijacked'
      : replay.outcome === 'BLOCKED'
        ? 'Outcome: contained · blocked'
        : 'Outcome: contained';

  const lines: string[] = [
    '◆ Warrant  Attack — one authored injection in the sandbox',
    `${replay.guardMode}  payload ${presetId}`,
    preset ? `  ${preset.description}` : '',
    '',
    outcome,
    '',
    `Called   ${replay.calledTools.join(', ') || '(none)'}`,
    `Blocked  ${replay.blockedTools.join(', ') || '(none)'}`,
    `Warrant  ${replay.warrantTools.join(', ') || '(none)'}`,
    `Source   recorded ${replay.replaySource ?? 'lab'}`,
    '',
    'Final answer',
    replay.finalAnswer || '—',
  ];

  if (replay.guardDecisions.length > 0) {
    lines.push('', 'Guard decisions');
    for (const decision of replay.guardDecisions) {
      const mark = decision.allowed ? 'allow' : 'deny';
      const code = decision.code === null ? '' : ` (${decision.code})`;
      lines.push(`  ${mark}  ${decision.tool}${code}`);
      lines.push(`         ${decision.reason}`);
    }
  }

  return lines.filter(
    (line, index) => !(line === '' && index === 2 && preset === undefined),
  );
}

export function formatGuardReplay(
  replay: ReplayView,
  detectOnly = false,
): readonly string[] {
  return [
    '◆ Warrant  Guard — route model traffic through the local proxy',
    '',
    '✔ Proxy listening at http://127.0.0.1:8787/v1',
    `${detectOnly ? 'DETECT_ONLY' : 'ENFORCE'}  guard mode`,
    'Intent   heuristic',
    'Stream   guard',
    'Approval deny-only (playground replay)',
    '',
    'Running: node agent.js',
    replay.blockedTools.length > 0
      ? `Blocked: ${replay.blockedTools.join(', ')}`
      : 'No blocks this turn',
    `Called:  ${replay.calledTools.join(', ') || '(none)'}`,
    '',
    replay.hijacked
      ? 'Agent exited · session was hijacked (recorded)'
      : 'Agent exited cleanly',
  ];
}
