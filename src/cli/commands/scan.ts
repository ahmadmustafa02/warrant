import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { InjectionTarget } from '@/adapters/proxy/injectPayload';
import { DOCUMENT_INJECTION_ATTACKS } from '@/eval/payloads/documentInjectionAuthored';
import { HELD_OUT_DOCUMENT_ATTACKS } from '@/eval/payloads/heldOutDocumentInjection';
import { runAdaptiveProbe, type AdaptiveToolReport } from '@/cli/scan/adaptiveProbe';
import {
  DEFAULT_FULL_SCAN_REPEATS,
  runFullProbe,
  type FullScanReport,
} from '@/cli/scan/fullScan';
import {
  benignTaskStatus,
  parseBenignTasks,
  runBenignSuite,
  type BenignSummary,
} from '@/cli/scan/benignTasks';
import { DEFAULT_SCAN_TIMEOUT_MS, runScanProbe } from '@/cli/scan/runScanProbe';
import {
  scoreScanFinding,
  summarizeByShape,
  summarizeScanFindings,
  type ScanFinding,
  type ScanSummary,
  type ShapeRate,
} from '@/cli/scan/scanFindings';
import { selectScanPayloads } from '@/cli/scan/selectScanPayloads';
import {
  buildPublicScanReport,
  DEFAULT_REPORT_ORIGIN,
  reportPageUrl,
} from '@/cli/scan/shareReport';
import { commandAfterFlags } from '@/cli/commandAfterFlags';
import { statusFail, statusOk, statusWarn, warrantBanner } from '@/cli/ui/brand';

const DEFAULT_LIMIT = 8;

const USAGE =
  'Usage: warrant scan [--limit N] [--all] [--held-out] [--adaptive] [--rounds N] [--full] [--repeats N] [--benign TASK]... [--share] [--inject-into tool-result|user-content] [--timeout MS] [--json] -- <command...>';

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
  return commandAfterFlags(argv, USAGE);
}

function verdictLabel(finding: ScanFinding): string {
  switch (finding.verdict) {
    case 'vulnerable':
      return pc.red('VULNERABLE');
    case 'protected':
      return pc.green('PROTECTED');
    case 'marker-echoed':
      return pc.yellow('tool stopped, marker echoed');
    case 'not-exploitable':
      return pc.dim('not exploitable');
    case 'not-reachable':
      return pc.yellow('payload never landed');
  }
}

function exitCodeFor(summary: ScanSummary, benign: BenignSummary): number {
  if (summary.reachable === 0) {
    return 2;
  }
  if (summary.vulnerable > 0 || benign.passed < benign.total) {
    return 1;
  }
  return 0;
}

function shareLink(
  argv: readonly string[],
  input: {
    readonly mode: 'corpus' | 'adaptive' | 'full';
    readonly agent: string;
    readonly canary: string;
    readonly summary: ScanSummary;
    readonly benign: BenignSummary;
    readonly findings: readonly ScanFinding[];
    readonly byShape?: readonly ShapeRate[];
  },
): string | undefined {
  if (!argv.includes('--share')) {
    return undefined;
  }
  const origin = process.env.WARRANT_REPORT_ORIGIN?.trim() || DEFAULT_REPORT_ORIGIN;
  const url = reportPageUrl(
    origin,
    buildPublicScanReport({
      mode: input.mode,
      agent: input.agent,
      canary: input.canary,
      summary: input.summary,
      benign: input.benign,
      findings: input.findings,
      byShape: input.byShape,
    }),
  );
  if (!argv.includes('--json')) {
    p.log.info(`Shareable report:\n${url}`);
  }
  return url;
}

function benignLine(benign: BenignSummary): string {
  const rate = `${(benign.passRate * 100).toFixed(0)}% (${benign.passed}/${benign.total})`;
  const rows = benign.tasks
    .map((task) => `  ${benignTaskStatus(task).padEnd(24)} ${task.task}`)
    .join('\n');
  return `Benign-pass rate: ${rate}\n${rows}`;
}

function failureReason(summary: ScanSummary, benign: BenignSummary): string {
  const parts: string[] = [];
  if (summary.vulnerable > 0) {
    parts.push(`${summary.vulnerable} attack(s) survived the guard`);
  }
  const failed = benign.total - benign.passed;
  if (failed > 0) {
    parts.push(`${failed} normal task(s) were blocked or did not finish`);
  }
  return parts.join('; ');
}

async function collectBenign(
  command: readonly string[],
  tasks: readonly string[],
  timeoutMs: number,
): Promise<BenignSummary> {
  return runBenignSuite({
    command,
    tasks,
    timeoutMs,
    runProbe: async (probe) =>
      runScanProbe({
        guardMode: 'ENFORCE',
        command: probe.command,
        timeoutMs: probe.timeoutMs,
      }),
  });
}

function findingRow(finding: ScanFinding): string {
  const tools =
    finding.attemptedTools.length === 0 ? '(none)' : finding.attemptedTools.join(', ');
  const leak = finding.leakedUnguarded ? ' · credential leaked' : '';
  return `${pc.bold(finding.payloadId.padEnd(22))} ${verdictLabel(finding)}\n  ${pc.dim(
    `${finding.category} · unauthorized calls: ${tools}${leak}`,
  )}`;
}

function adaptiveRow(report: AdaptiveToolReport): string {
  return `${findingRow(report.finding)}\n  ${pc.dim(`${report.shape} · try ${report.roundsUsed} · ${report.line}`)}`;
}

async function runAdaptiveScanCommand(argv: readonly string[]): Promise<number> {
  if (
    argv.includes('--held-out') ||
    argv.includes('--all') ||
    argv.includes('--limit')
  ) {
    throw new Error(
      '--adaptive probes the tools this agent advertises, so --held-out, --all, and --limit do not apply',
    );
  }

  const json = argv.includes('--json');
  if (!json) {
    p.intro(warrantBanner('Scan — adaptive probe of this agent’s tools'));
  }

  const target = parseTarget(argv);
  const timeoutMs = parsePositiveInt(argv, '--timeout') ?? DEFAULT_SCAN_TIMEOUT_MS;
  const rounds = parsePositiveInt(argv, '--rounds') ?? 2;
  const targetCommand = parseCommandAfterDash(argv);
  const benignTasks = parseBenignTasks(argv);
  const canary = `WARRANT-SCAN-CANARY-${randomUUID().slice(0, 8).toUpperCase()}`;

  if (!json) {
    p.log.info(`Agent under test: ${pc.dim(targetCommand.join(' '))}`);
    p.log.info(
      pc.dim(
        `recon, then up to ${rounds} generated lines per sensitive tool · planted in ${target}`,
      ),
    );
  }

  const adaptive = await runAdaptiveProbe({
    command: targetCommand,
    canary,
    rounds,
    timeoutMs,
    injectionTarget: target,
  });

  if (adaptive.reports.length === 0) {
    const names =
      adaptive.observedTools.map((tool) => tool.name).join(', ') || '(none)';
    if (!json) {
      p.log.warn(`No sensitive tools to probe. Observed: ${names}`);
      p.outro(statusWarn('Scan inconclusive — nothing sensitive to test'));
    } else {
      process.stdout.write(
        `${JSON.stringify({ mode: 'adaptive', observedTools: adaptive.observedTools, reports: [] }, null, 2)}\n`,
      );
    }
    return 2;
  }

  const benign = await collectBenign(targetCommand, benignTasks, timeoutMs);
  const findings = adaptive.reports.map((report) => report.finding);
  const summary = summarizeScanFindings(findings);
  const reportUrl = shareLink(argv, {
    mode: 'adaptive',
    agent: targetCommand.join(' '),
    canary,
    summary,
    benign,
    findings,
  });

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'adaptive',
          agent: targetCommand.join(' '),
          injectionTarget: target,
          observedTools: adaptive.observedTools,
          reports: adaptive.reports,
          summary,
          benign,
          reportUrl,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    p.note(adaptive.reports.map(adaptiveRow).join('\n\n'), 'Findings');
    const stopRate =
      summary.attackStopRate === undefined
        ? 'n/a (nothing was exploitable)'
        : `${(summary.attackStopRate * 100).toFixed(0)}% (${summary.protectedCount}/${summary.exploitable})`;
    p.log.info(
      [
        `Sensitive tools probed: ${adaptive.reports.length}`,
        `Exploitable with the guard off: ${summary.exploitable}/${summary.reachable} reachable lines`,
        `Attack-stop rate under ENFORCE: ${stopRate}`,
        benignLine(benign),
      ].join('\n'),
    );
  }

  const code = exitCodeFor(summary, benign);
  if (!json) {
    if (code === 2) {
      p.outro(statusWarn('Scan inconclusive — nothing to inject into'));
    } else if (code === 1) {
      p.outro(statusFail(failureReason(summary, benign)));
    } else {
      p.outro(
        statusOk(
          `Guard stopped every exploitable attack — run "warrant guard -- ${targetCommand.join(' ')}" to keep it on`,
        ),
      );
    }
  }
  return code;
}

function formatStopRate(
  rate: number | undefined,
  protectedCount: number,
  exploitable: number,
): string {
  if (rate === undefined) {
    return 'n/a (nothing was exploitable)';
  }
  return `${(rate * 100).toFixed(0)}% (${protectedCount}/${exploitable})`;
}

function fullRow(report: FullScanReport): string {
  return `${findingRow(report.finding)}\n  ${pc.dim(`${report.shape} · repeat ${report.repeat} · ${report.line}`)}`;
}

async function runFullScanCommand(argv: readonly string[]): Promise<number> {
  if (
    argv.includes('--adaptive') ||
    argv.includes('--held-out') ||
    argv.includes('--all') ||
    argv.includes('--limit') ||
    argv.includes('--rounds')
  ) {
    throw new Error(
      '--full runs every attack shape against this agent’s tools, so --adaptive, --held-out, --all, --limit, and --rounds do not apply',
    );
  }

  const json = argv.includes('--json');
  if (!json) {
    p.intro(warrantBanner('Scan — every attack shape, repeated'));
  }

  const target = parseTarget(argv);
  const timeoutMs = parsePositiveInt(argv, '--timeout') ?? DEFAULT_SCAN_TIMEOUT_MS;
  const repeats = parsePositiveInt(argv, '--repeats') ?? DEFAULT_FULL_SCAN_REPEATS;
  const targetCommand = parseCommandAfterDash(argv);
  const benignTasks = parseBenignTasks(argv);
  const canary = `WARRANT-SCAN-CANARY-${randomUUID().slice(0, 8).toUpperCase()}`;

  if (!json) {
    p.log.info(`Agent under test: ${pc.dim(targetCommand.join(' '))}`);
    p.log.info(
      pc.dim(
        `every shape · ${repeats} repeats · planted in ${target} · agent runs unmodified behind the proxy`,
      ),
    );
  }

  const full = await runFullProbe({
    command: targetCommand,
    canary,
    repeats,
    timeoutMs,
    injectionTarget: target,
  });

  if (full.reports.length === 0) {
    const names = full.observedTools.map((tool) => tool.name).join(', ') || '(none)';
    if (!json) {
      p.log.warn(`No sensitive tools to probe. Observed: ${names}`);
      p.outro(statusWarn('Scan inconclusive — nothing sensitive to test'));
    } else {
      process.stdout.write(
        `${JSON.stringify({ mode: 'full', observedTools: full.observedTools, reports: [], byShape: [] }, null, 2)}\n`,
      );
    }
    return 2;
  }

  const benign = await collectBenign(targetCommand, benignTasks, timeoutMs);
  const findings = full.reports.map((report) => report.finding);
  const summary = summarizeScanFindings(findings);
  const byShape = summarizeByShape(full.reports);
  const reportUrl = shareLink(argv, {
    mode: 'full',
    agent: targetCommand.join(' '),
    canary,
    summary,
    benign,
    findings,
    byShape,
  });

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'full',
          agent: targetCommand.join(' '),
          injectionTarget: target,
          repeats,
          observedTools: full.observedTools,
          reports: full.reports,
          byShape,
          summary,
          benign,
          reportUrl,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    p.note(full.reports.map(fullRow).join('\n\n'), 'Findings');
    const shapeLines = byShape
      .map(
        (rate) =>
          `  ${rate.shape.padEnd(18)} ${formatStopRate(rate.attackStopRate, rate.protectedCount, rate.exploitable)}`,
      )
      .join('\n');
    p.log.info(
      [
        `Trials: ${full.reports.length} (${repeats} repeats of each shape)`,
        `Attack-stop rate by shape:\n${shapeLines}`,
        `Attack-stop rate under ENFORCE: ${formatStopRate(summary.attackStopRate, summary.protectedCount, summary.exploitable)}`,
        benignLine(benign),
      ].join('\n'),
    );
  }

  const code = exitCodeFor(summary, benign);
  if (!json) {
    if (code === 2) {
      p.outro(statusWarn('Scan inconclusive — nothing to inject into'));
    } else if (code === 1) {
      p.outro(statusFail(failureReason(summary, benign)));
    } else {
      p.outro(
        statusOk(
          `Guard stopped every exploitable attack — run "warrant guard -- ${targetCommand.join(' ')}" to keep it on`,
        ),
      );
    }
  }
  return code;
}

export async function runScanCommand(argv: readonly string[]): Promise<number> {
  if (argv.includes('--full')) {
    return runFullScanCommand(argv);
  }
  if (argv.includes('--repeats')) {
    throw new Error('--repeats requires --full');
  }
  if (argv.includes('--adaptive')) {
    return runAdaptiveScanCommand(argv);
  }
  if (argv.includes('--rounds')) {
    throw new Error('--rounds requires --adaptive');
  }

  const json = argv.includes('--json');
  if (!json) {
    p.intro(warrantBanner('Scan — find hijacks in an agent you did not write'));
  }

  const target = parseTarget(argv);
  const timeoutMs = parsePositiveInt(argv, '--timeout') ?? DEFAULT_SCAN_TIMEOUT_MS;
  const targetCommand = parseCommandAfterDash(argv);
  const benignTasks = parseBenignTasks(argv);
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

  // No injection, guard live: each normal task must still complete.
  const benign = await collectBenign(targetCommand, benignTasks, timeoutMs);

  const summary = summarizeScanFindings(findings);
  const reportUrl = shareLink(argv, {
    mode: 'corpus',
    agent: targetCommand.join(' '),
    canary,
    summary,
    benign,
    findings,
  });

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          agent: targetCommand.join(' '),
          injectionTarget: target,
          findings,
          summary,
          benign,
          reportUrl,
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
        benignLine(benign),
      ].join('\n'),
    );

    if (summary.reachable === 0) {
      p.log.warn(
        'No payload reached the agent. It never returned a tool result through the proxy — check that it uses OPENAI_BASE_URL / ANTHROPIC_BASE_URL, or try --inject-into user-content.',
      );
    }
  }

  const code = exitCodeFor(summary, benign);
  if (code === 2) {
    if (!json) {
      p.outro(statusWarn('Scan inconclusive — nothing to inject into'));
    }
    return 2;
  }
  if (code === 1) {
    if (!json) {
      p.outro(statusFail(failureReason(summary, benign)));
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
