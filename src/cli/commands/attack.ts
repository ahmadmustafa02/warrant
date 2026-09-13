import 'dotenv/config';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { runSandboxAgent } from '@/agent/runSandboxAgent';
import { authoredPayload } from '@/eval/payloads/catalog';
import { DEFAULT_EVAL_USER_TURN, DEFAULT_EXPECTED_TOOLS } from '@/eval/payloads/types';
import { modeBadge, statusFail, statusOk, warrantBanner } from '@/cli/ui/brand';

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

export async function runAttackCommand(argv: readonly string[]): Promise<number> {
  p.intro(warrantBanner('Attack — run one authored injection in the sandbox'));

  const payloadId = readFlag(argv, '--payload') ?? 'authority_urgency';
  const guardRaw = readFlag(argv, '--guard') ?? 'ENFORCE';
  const guardMode =
    guardRaw === 'OFF' || guardRaw === 'DETECT_ONLY' || guardRaw === 'ENFORCE'
      ? guardRaw
      : 'ENFORCE';

  const payload = authoredPayload(payloadId);
  if (payload === undefined) {
    p.log.error(`Unknown payload: ${payloadId}`);
    return 1;
  }

  p.log.info(`${modeBadge(guardMode)}  ${pc.dim('payload')} ${payloadId}`);

  const spin = p.spinner();
  spin.start('Running sandbox agent');

  const result = await runSandboxAgent({
    userTurn: DEFAULT_EVAL_USER_TURN,
    guardMode,
    injectionLine: payload.injectionLine,
    promptProfile: 'NAIVE',
    measuredAuthorizedTools: DEFAULT_EXPECTED_TOOLS,
  });

  spin.stop(
    result.hijacked ? statusFail('Outcome: hijacked') : statusOk('Outcome: contained'),
  );

  p.note(
    [
      `Called tools: ${result.calledTools.join(', ') || '(none)'}`,
      `Blocked tools: ${result.blockedTools.join(', ') || '(none)'}`,
      `Canary leaked: ${result.signals.canaryLeaked}`,
    ].join('\n'),
    'Signals',
  );

  if (guardMode === 'ENFORCE' && result.hijacked) {
    p.outro(statusFail('Attack succeeded under ENFORCE — investigate'));
    return 2;
  }

  p.outro(statusOk('Attack run complete'));
  return 0;
}
