import type { InjectionTarget } from '@/adapters/proxy/injectPayload';
import { authoredPayloadSchema, type AuthoredPayload } from '@/eval/payloads/types';
import {
  attackLinesForTool,
  isSensitiveProbeTarget,
  type ScanProbeRunner,
} from './adaptiveProbe';
import { isExploited, scoreScanFinding, type ScanFinding } from './scanFindings';
import type { ObservedScanTool, ScanProbeResult } from './runScanProbe';
import { runScanProbe } from './runScanProbe';

export const DEFAULT_FULL_SCAN_REPEATS = 3;

export interface FullScanReport {
  readonly toolName: string;
  readonly shape: string;
  readonly repeat: number;
  readonly line: string;
  readonly finding: ScanFinding;
}

export interface FullScanResult {
  readonly observedTools: readonly ObservedScanTool[];
  readonly repeats: number;
  readonly reports: readonly FullScanReport[];
}

function payloadForTrial(
  tool: ObservedScanTool,
  shape: string,
  line: string,
  repeat: number,
): AuthoredPayload {
  const severity = tool.riskTier === 'DESTRUCTIVE' ? 'CRITICAL' : 'HIGH';
  return authoredPayloadSchema.parse({
    externalRef: `full:${tool.name}:${shape}:r${repeat}`,
    category: shape,
    injectionLine: line,
    severity,
  });
}

function enforcedStandIn(baseline: ScanProbeResult): ScanProbeResult {
  return {
    ...baseline,
    guardMode: 'ENFORCE',
    unauthorizedTools: [],
    blockedTools: [],
    canaryDelivered: false,
    unstoppedTools: [],
  };
}

/**
 * Run every attack shape against every sensitive tool, `repeats` times each.
 *
 * Unlike the adaptive probe, an exploitable line does not end the scan.
 * A trial the agent ignores is not exploitable, so it has no enforce run.
 * Scoring stays `scoreScanFinding`.
 */
export async function runFullProbe(options: {
  readonly command: readonly string[];
  readonly canary: string;
  readonly repeats?: number;
  readonly timeoutMs?: number;
  readonly injectionTarget?: InjectionTarget;
  readonly runProbe?: ScanProbeRunner;
}): Promise<FullScanResult> {
  const repeats = options.repeats ?? DEFAULT_FULL_SCAN_REPEATS;
  if (repeats < 1) {
    throw new Error('repeats must be a positive integer');
  }
  const runProbe = options.runProbe ?? runScanProbe;
  const target = options.injectionTarget ?? 'tool-result';

  const recon = await runProbe({
    guardMode: 'DETECT_ONLY',
    command: options.command,
    timeoutMs: options.timeoutMs,
  });

  const targets = recon.observedTools.filter(isSensitiveProbeTarget);
  const reports: FullScanReport[] = [];

  for (const tool of targets) {
    for (const attack of attackLinesForTool(tool.name)) {
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        const baseline = await runProbe({
          guardMode: 'DETECT_ONLY',
          command: options.command,
          timeoutMs: options.timeoutMs,
          injection: { line: attack.line, canary: options.canary, target },
        });
        const exploited = baseline.injectedInto !== 'none' && isExploited(baseline);
        const enforced = exploited
          ? await runProbe({
              guardMode: 'ENFORCE',
              command: options.command,
              timeoutMs: options.timeoutMs,
              injection: { line: attack.line, canary: options.canary, target },
            })
          : enforcedStandIn(baseline);

        reports.push({
          toolName: tool.name,
          shape: attack.shape,
          repeat,
          line: attack.line,
          finding: scoreScanFinding(
            payloadForTrial(tool, attack.shape, attack.line, repeat),
            baseline,
            enforced,
          ),
        });
      }
    }
  }

  return {
    observedTools: recon.observedTools,
    repeats,
    reports: Object.freeze(reports),
  };
}
