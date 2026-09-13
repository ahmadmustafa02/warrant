import 'dotenv/config';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { DOCUMENT_INJECTION_ATTACKS } from '@/eval/payloads/documentInjectionAuthored';
import { HELD_OUT_DOCUMENT_ATTACKS } from '@/eval/payloads/heldOutDocumentInjection';
import type { AuthoredPayload } from '@/eval/payloads/types';
import { runAgentProbe } from '@/cli/redTeam/runAgentProbe';
import { modeBadge, statusOk, statusWarn, warrantBanner } from '@/cli/ui/brand';

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function parseCommandAfterDash(argv: readonly string[]): string[] {
  const dash = argv.indexOf('--');
  if (dash < 0 || dash === argv.length - 1) {
    throw new Error('Usage: warrant red-team [--limit N] [--held-out] -- <command...>');
  }
  return argv.slice(dash + 1);
}

function parseLimit(argv: readonly string[]): number | undefined {
  const raw = readFlag(argv, '--limit');
  if (raw === undefined) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) {
    throw new Error('--limit must be a positive integer');
  }
  return value;
}

export async function runRedTeamCommand(argv: readonly string[]): Promise<number> {
  p.intro(warrantBanner('Red-team — guard off, then guard on'));

  const heldOut = argv.includes('--held-out');
  const limit = parseLimit(argv);
  const targetCommand = parseCommandAfterDash(argv);

  let payloads: readonly AuthoredPayload[] = heldOut
    ? HELD_OUT_DOCUMENT_ATTACKS
    : DOCUMENT_INJECTION_ATTACKS;
  if (limit !== undefined) {
    payloads = payloads.slice(0, limit);
  }

  p.log.info(`Agent: ${pc.dim(targetCommand.join(' '))}`);
  p.log.info(
    pc.dim(
      'Sets WARRANT_EVAL_USER_TURN / WARRANT_EVAL_INJECTION and OPENAI_BASE_URL to the local proxy.',
    ),
  );

  let offHijacks = 0;
  let enforceHijacks = 0;
  let enforceStops = 0;
  const rows: string[] = [];

  for (const payload of payloads) {
    const spin = p.spinner();
    spin.start(`Payload ${payload.externalRef}`);

    let off;
    let enforce;
    try {
      off = await runAgentProbe({
        guardMode: 'OFF',
        payload,
        command: targetCommand,
      });
      enforce = await runAgentProbe({
        guardMode: 'ENFORCE',
        payload,
        command: targetCommand,
      });
    } catch (error) {
      spin.stop(`${payload.externalRef} · failed`);
      throw error;
    }

    spin.stop(`${payload.externalRef} · off ${off.hijacked ? 'hijacked' : 'ok'}`);

    if (off.hijacked) {
      offHijacks += 1;
    }
    if (enforce.hijacked) {
      enforceHijacks += 1;
    }
    if (!enforce.hijacked && off.hijacked) {
      enforceStops += 1;
    }

    rows.push(
      [
        pc.bold(payload.externalRef),
        `${modeBadge('OFF')}  hijacked=${off.hijacked}  tools=${off.calledTools.join(', ') || '(none)'}`,
        `${modeBadge('ENFORCE')}  hijacked=${enforce.hijacked}  blocked=${enforce.blockedTools.join(', ') || '(none)'}`,
      ].join('\n'),
    );
  }

  p.note(rows.join('\n\n'), 'Results');

  const total = payloads.length;
  p.log.info(
    [
      `Guard OFF:  ${offHijacks}/${total} hijacked`,
      `Guard ENFORCE: ${enforceStops}/${total} attacks stopped (was hijacked with guard off)`,
      `Guard ENFORCE: ${enforceHijacks}/${total} still hijacked (investigate)`,
    ].join('\n'),
  );

  if (enforceHijacks > 0) {
    p.outro(statusWarn('Some attacks still succeeded under ENFORCE'));
    return 2;
  }

  p.outro(statusOk('Red-team complete'));
  return 0;
}
