import { deflateRawSync } from 'node:zlib';
import type { BenignSummary } from './benignTasks';
import type { ScanFinding, ScanSummary, ShapeRate } from './scanFindings';
import { publicScanReportSchema, type PublicScanReport } from './shareReportSchema';

export const DEFAULT_REPORT_ORIGIN = 'https://warrant-lab.vercel.app';

export { publicScanReportSchema, type PublicScanReport };

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function redact(value: string, canary: string | undefined): string {
  if (canary === undefined || canary === '') {
    return value;
  }
  return value.split(canary).join('[canary]');
}

function rateOrNull(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

/**
 * The shareable view of a finished scan.
 *
 * Injection lines and the canary stay out. Attack-stop and benign-pass are
 * both required, so a link cannot show one number without the other.
 */
export function buildPublicScanReport(input: {
  readonly mode: PublicScanReport['mode'];
  readonly agent: string;
  readonly at?: string;
  readonly canary?: string;
  readonly summary: ScanSummary;
  readonly benign: BenignSummary;
  readonly findings: readonly ScanFinding[];
  readonly byShape?: readonly ShapeRate[];
}): PublicScanReport {
  const hide = (value: string): string => redact(value, input.canary);
  return publicScanReportSchema.parse({
    v: 1,
    at: input.at ?? new Date().toISOString(),
    mode: input.mode,
    agent: clip(hide(input.agent), 500),
    summary: {
      payloads: input.summary.payloads,
      reachable: input.summary.reachable,
      exploitable: input.summary.exploitable,
      protectedCount: input.summary.protectedCount,
      vulnerable: input.summary.vulnerable,
      attackStopRate: rateOrNull(input.summary.attackStopRate),
    },
    byShape: (input.byShape ?? []).slice(0, 20).map((shape) => ({
      shape: clip(shape.shape, 80),
      trials: shape.trials,
      exploitable: shape.exploitable,
      protectedCount: shape.protectedCount,
      vulnerable: shape.vulnerable,
      attackStopRate: rateOrNull(shape.attackStopRate),
    })),
    benign: {
      passed: input.benign.passed,
      total: input.benign.total,
      passRate: input.benign.passRate,
      tasks: input.benign.tasks.slice(0, 20).map((task) => ({
        task: clip(hide(task.task), 300),
        passed: task.passed,
      })),
    },
    findings: input.findings.slice(0, 80).map((finding) => ({
      id: clip(hide(finding.payloadId), 120),
      category: clip(hide(finding.category), 80),
      verdict: finding.verdict,
      tools: finding.attemptedTools.slice(0, 12).map((tool) => clip(hide(tool), 80)),
    })),
  });
}

/** Raw deflate, base64url. The report page inflates this from the URL fragment. */
export function encodeReportFragment(report: PublicScanReport): string {
  const json = JSON.stringify(publicScanReportSchema.parse(report));
  return deflateRawSync(Buffer.from(json, 'utf8')).toString('base64url');
}

export function reportPageUrl(origin: string, report: PublicScanReport): string {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${base}/report#${encodeReportFragment(report)}`;
}
