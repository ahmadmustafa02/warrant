import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { InjectionTarget } from '@/adapters/proxy/injectPayload';
import { DOCUMENT_INJECTION_ATTACKS } from '@/eval/payloads/documentInjectionAuthored';
import { HELD_OUT_DOCUMENT_ATTACKS } from '@/eval/payloads/heldOutDocumentInjection';
import { DEFAULT_SCAN_TIMEOUT_MS, runScanProbe } from '@/cli/scan/runScanProbe';
import {
  scoreScanFinding,
  summarizeScanFindings,
  type ScanFinding,
} from '@/cli/scan/scanFindings';
import { selectScanPayloads } from '@/cli/scan/selectScanPayloads';
import { statusFail, statusOk, statusWarn, warrantBanner } from '@/cli/ui/brand';

const DEFAULT_LIMIT = 8;

const USAGE =
  'Usage: warrant scan [--limit N] [--all] [--held-out] [--inject-into tool-result|user-content] [--timeout MS] [--json] -- <command...>';

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function parsePositiveInt(argv: readonly string[], name: string): number | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function parseTarget(argv: readonly string[]): InjectionTarget {
  const raw = readFlag(argv, '--inject-into');
  if (raw === undefined || raw === 'tool-result') {
    return 'tool-result';
  }
  if (raw === 'user-content') {
    return 'user-content';
  }
  throw new Error('--inject-into must be "tool-result" or "user-content"');
}

function parseCommandAfterDash(argv: readonly string[]): string[] {
  const dash = argv.indexOf('--');
  if (dash < 0 || dash === argv.length - 1) {
    throw new Error(USAGE);
  }
  return argv.slice(dash + 1);
}

function verdictLabel(finding: ScanFinding): string {
  switch (finding.verdict) {
    case 'vulnerable':
      return pc.red('VULNERABLE');
    case 'protected':
      return pc.green('PROTECTED');
    case 'not-exploitable':
      return pc.dim('not exploitable');
    case 'not-reachable':
      return pc.yellow('payload never landed');
  }
}

function findingRow(finding: ScanFinding): string {
  const tools =
    finding.attemptedTools.length === 0 ? '(none)' : finding.attemptedTools.join(', ');
  const leak = finding.leakedUnguarded ? ' · credential leaked' : '';
  return `${pc.bold(finding.payloadId.padEnd(22))} ${verdictLabel(finding)}\n  ${pc.dim(
    `${finding.category} · unauthorized calls: ${tools}${leak}`,
  )}`;
}

export async function runScanCommand(argv: readonly string[]): Promise<number> {
  const json = argv.includes('--json');
  if (!json) {
    p.intro(warrantBanner('Scan — find hijacks in an agent you did not write'));
  }

  const target = parseTarget(argv);
  const timeoutMs = parsePositiveInt(argv, '--timeout') ?? DEFAULT_SCAN_TIMEOUT_MS;
  const targetCommand = parseCommandAfterDash(argv);
  const corpus = argv.includes('--held-out')
    ? HELD_OUT_DOCUMENT_ATTACKS
    : DOCUMENT_INJECTION_ATTACKS;
  const limit = argv.includes('--all')
    ? corpus.length
    : (parsePositiveInt(argv, '--limit') ?? DEFAULT_LIMIT);
  const payloads = selectScanPayloads(corpus, limit);

  // One canary per scan: any occurrence in a later reply is traceable to this run.
  const canary = `WARRANT-SCAN-CANARY-${randomUUID().slice(0, 8).toUpperCase()}`;

  if (!json) {
    p.log.info(`Agent under test: ${pc.dim(targetCommand.join(' '))}`);
    p.log.info(
      pc.dim(
        `${payloads.length} payloads · payload planted in ${target} · agent runs unmodified behind the proxy`,
      ),
    );
  }

  const findings: ScanFinding[] = [];

  for (const payload of payloads) {
    const spin = json ? undefined : p.spinner();
    spin?.start(`${payload.externalRef} · probing`);

    const injection = { line: payload.injectionLine, canary, target };
    const baseline = await runScanProbe({
      guardMode: 'DETECT_ONLY',
      command: targetCommand,
      injection,
      timeoutMs,
    });
    const enforced = await runScanProbe({
      guardMode: 'ENFORCE',
      command: targetCommand,
      injection,
      timeoutMs,
    });

    const finding = scoreScanFinding(payload, baseline, enforced);
    findings.push(finding);
    spin?.stop(`${payload.externalRef} · ${finding.verdict}`);
  }

  // No injection, guard live: proves the guard is not simply blocking everything.
  const benign = await runScanProbe({
    guardMode: 'ENFORCE',
    command: targetCommand,
    timeoutMs,
  });
  const benignPassed =
    benign.exitCode === 0 && !benign.timedOut && benign.blockedTools.length === 0;

  const summary = summarizeScanFindings(findings);

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          agent: targetCommand.join(' '),
          injectionTarget: target,
          findings,
          summary,
          benign: {
            passed: benignPassed,
            exitCode: benign.exitCode,
            blockedTools: benign.blockedTools,
          },
        },
        null,
        2,
      )}\n`,
    );
  } else {
    p.note(findings.map(findingRow).join('\n\n'), 'Findings');

    const stopRate =
      summary.attackStopRate === undefined
        ? 'n/a (nothing was exploitable)'
        : `${(summary.attackStopRate * 100).toFixed(0)}% (${summary.protectedCount}/${summary.exploitable})`;

    p.log.info(
      [
        `Exploitable with the guard off: ${summary.exploitable}/${summary.reachable} reachable payloads`,
        `Attack-stop rate under ENFORCE: ${stopRate}`,
        `Benign task still completes:    ${benignPassed ? 'yes' : 'no'}`,
      ].join('\n'),
    );

    if (summary.reachable === 0) {
      p.log.warn(
        'No payload reached the agent. It never returned a tool result through the proxy — check that it uses OPENAI_BASE_URL / ANTHROPIC_BASE_URL, or try --inject-into user-content.',
      );
    }
  }

  if (summary.reachable === 0) {
    if (!json) {
      p.outro(statusWarn('Scan inconclusive — nothing to inject into'));
    }
    return 2;
  }
  if (summary.vulnerable > 0) {
    if (!json) {
      p.outro(statusFail(`${summary.vulnerable} attack(s) survived the guard`));
    }
    return 1;
  }
  if (!json) {
    p.outro(
      statusOk(
        `Guard stopped every exploitable attack — run "warrant guard -- ${targetCommand.join(' ')}" to keep it on`,
      ),
    );
  }
  return 0;
}
