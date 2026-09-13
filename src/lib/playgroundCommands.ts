import { PLAYGROUND_PRESETS } from '@/lib/playgroundPresets';

export type PlaygroundGuardMode = 'OFF' | 'ENFORCE';

export type ParsedPlaygroundCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'install' }
  | { readonly kind: 'init' }
  | { readonly kind: 'doctor' }
  | { readonly kind: 'eval-intent' }
  | {
      readonly kind: 'attack';
      readonly presetId: string;
      readonly guardMode: PlaygroundGuardMode;
    }
  | { readonly kind: 'guard'; readonly detectOnly: boolean }
  | { readonly kind: 'unknown'; readonly input: string };

export type CommandChip = {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly hint: string;
};

export const COMMAND_CHIPS: readonly CommandChip[] = [
  {
    id: 'install',
    label: 'install',
    command: 'npm install -g @warrant-lab/cli',
    hint: 'Demo install log',
  },
  {
    id: 'init',
    label: 'init',
    command: 'warrant init --from-sandbox',
    hint: 'Write policy',
  },
  {
    id: 'doctor',
    label: 'doctor',
    command: 'warrant doctor',
    hint: 'Health check',
  },
  {
    id: 'attack-off',
    label: 'attack · off',
    command: 'warrant attack --payload task_disguise --guard OFF',
    hint: 'Recorded hijack',
  },
  {
    id: 'attack-on',
    label: 'attack · enforce',
    command: 'warrant attack --payload task_disguise --guard ENFORCE',
    hint: 'Recorded block',
  },
  {
    id: 'guard',
    label: 'guard',
    command: 'warrant guard -- node agent.js',
    hint: 'Proxy session replay',
  },
  {
    id: 'help',
    label: 'help',
    command: 'help',
    hint: 'Allowed commands',
  },
];

const DEFAULT_PRESET = PLAYGROUND_PRESETS[0]?.id ?? 'task_disguise';

function normalize(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function readFlag(tokens: readonly string[], name: string): string | undefined {
  const index = tokens.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return tokens[index + 1];
}

function resolvePreset(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return DEFAULT_PRESET;
  }
  if (PLAYGROUND_PRESETS.some((preset) => preset.id === raw)) {
    return raw;
  }
  return undefined;
}

function resolveGuard(raw: string | undefined): PlaygroundGuardMode | undefined {
  if (raw === undefined) {
    return 'OFF';
  }
  const upper = raw.toUpperCase();
  if (upper === 'OFF' || upper === 'ENFORCE') {
    return upper;
  }
  return undefined;
}

/** Only allowlisted playground commands resolve. Everything else is unknown. */
export function parsePlaygroundCommand(raw: string): ParsedPlaygroundCommand {
  const input = normalize(raw);
  if (input === '') {
    return { kind: 'unknown', input };
  }

  const lower = input.toLowerCase();

  if (lower === 'help' || lower === 'warrant' || lower === 'warrant --help') {
    return { kind: 'help' };
  }
  if (lower === 'clear' || lower === 'cls') {
    return { kind: 'clear' };
  }
  if (
    lower === 'npm install -g @warrant-lab/cli' ||
    lower === 'npm i -g @warrant-lab/cli' ||
    lower === 'npx @warrant-lab/cli'
  ) {
    return { kind: 'install' };
  }
  if (lower === 'warrant init' || lower === 'warrant init --from-sandbox') {
    return { kind: 'init' };
  }
  if (lower === 'warrant doctor') {
    return { kind: 'doctor' };
  }
  if (lower === 'warrant eval intent') {
    return { kind: 'eval-intent' };
  }

  const tokens = input.split(' ');
  if (tokens[0] === 'warrant' && tokens[1] === 'attack') {
    const presetId = resolvePreset(readFlag(tokens, '--payload'));
    const guardMode = resolveGuard(readFlag(tokens, '--guard'));
    if (presetId === undefined || guardMode === undefined) {
      return { kind: 'unknown', input };
    }
    return { kind: 'attack', presetId, guardMode };
  }

  if (tokens[0] === 'warrant' && tokens[1] === 'guard') {
    const detectOnly = tokens.includes('--detect-only');
    const hasAgent = tokens.includes('--');
    if (!hasAgent && tokens.length > 2 && !detectOnly) {
      return { kind: 'unknown', input };
    }
    return { kind: 'guard', detectOnly };
  }

  return { kind: 'unknown', input };
}

export function suggestPlaygroundCommand(partial: string): string | undefined {
  const needle = normalize(partial).toLowerCase();
  if (needle === '') {
    return undefined;
  }
  const match = COMMAND_CHIPS.find((chip) =>
    chip.command.toLowerCase().startsWith(needle),
  );
  return match?.command;
}

export const HELP_LINES: readonly string[] = [
  'Warrant playground — recorded demos only. No live install, no live model.',
  '',
  '  npm install -g @warrant-lab/cli',
  '  warrant init --from-sandbox',
  '  warrant doctor',
  '  warrant eval intent',
  '  warrant attack --payload <id> --guard OFF|ENFORCE',
  '  warrant guard -- node agent.js',
  '  clear',
  '',
  `Payloads: ${PLAYGROUND_PRESETS.map((preset) => preset.id).join(', ')}`,
];

export const INSTALL_LINES: readonly string[] = [
  'added 1 package in 1.2s',
  '',
  '  @warrant-lab/cli@0.1.0',
  '  bin: warrant',
  '',
  'Demo complete. This page never runs npm on your machine.',
];

export const INIT_LINES: readonly string[] = [
  '◆ Warrant  provenance guard for agent tool calls',
  'Init — write .warrant/proxy-policy.json',
  '',
  '✔ Wrote .warrant/proxy-policy.json',
  '',
  '{',
  '  "intentMode": "heuristic",',
  '  "approvalMode": "prompt",',
  '  "streaming": "guard",',
  '  "destructiveRequiresExplicitUser": true',
  '}',
  '',
  'Ready — run warrant guard -- your-agent',
];

export const DOCTOR_LINES: readonly string[] = [
  '◆ Warrant  provenance guard for agent tool calls',
  'Doctor — environment and registry checks',
  '',
  '✔ Model API key present (demo).',
  '✔ Policy loaded (heuristic, streaming guard).',
  '✔ Registry audit clean',
];

export const EVAL_INTENT_LINES: readonly string[] = [
  '◆ Warrant  Intent bench — heuristic vs LLM parser',
  '',
  'default eval turn',
  '  heuristic  read_document',
  '  llm        read_document',
  '  match',
  '',
  'explicit email',
  '  heuristic  read_document, send_email',
  '  llm        read_document, send_email',
  '  match',
  '',
  'Agreement: 2/2 fixtures (seeded demo)',
];

export function unknownCommandLines(input: string): readonly string[] {
  return [
    `command not allowed: ${input === '' ? '(empty)' : input}`,
    'This terminal only replays seeded demos. Type help or tap a chip.',
  ];
}
