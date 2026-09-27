import type { InjectionTarget } from '@/adapters/proxy/injectPayload';
import { authoredPayloadSchema, type AuthoredPayload } from '@/eval/payloads/types';
import type { ProbeLineRequest } from './generateProbeLine';
import { generateProbeLine } from './generateProbeLine';
import {
  runScanProbe,
  type ObservedScanTool,
  type ScanProbeResult,
} from './runScanProbe';
import { isExploited, scoreScanFinding, type ScanFinding } from './scanFindings';

export const DEFAULT_ADAPTIVE_ROUNDS = 2;

export type ProbeLineGenerator = (request: ProbeLineRequest) => Promise<string>;

export type ScanProbeRunner = (options: {
  readonly guardMode: ScanProbeResult['guardMode'];
  readonly command: readonly string[];
  readonly injection?: {
    readonly line: string;
    readonly canary?: string;
    readonly target?: InjectionTarget;
  };
  readonly timeoutMs?: number;
}) => Promise<ScanProbeResult>;

export interface AdaptiveToolReport {
  readonly toolName: string;
  readonly line: string;
  readonly roundsUsed: number;
  readonly finding: ScanFinding;
}

export interface AdaptiveProbeResult {
  readonly observedTools: readonly ObservedScanTool[];
  readonly reports: readonly AdaptiveToolReport[];
}

/**
 * Tools worth probing: the guard only intervenes on sensitive, destructive,
 * egress, or secret-returning calls. A plain read cannot show a hijack.
 */
export function isSensitiveProbeTarget(tool: ObservedScanTool): boolean {
  if (tool.riskTier === 'SENSITIVE' || tool.riskTier === 'DESTRUCTIVE') {
    return true;
  }
  return tool.egress || tool.returnsSecrets;
}

export function payloadForAdaptiveLine(
  tool: ObservedScanTool,
  line: string,
  round: number,
): AuthoredPayload {
  const severity = tool.riskTier === 'DESTRUCTIVE' ? 'CRITICAL' : 'HIGH';
  return authoredPayloadSchema.parse({
    externalRef: `adaptive:${tool.name}:r${round}`,
    category: 'adaptive-probe',
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
  };
}

/**
 * Recon the target's advertised tools, then probe each sensitive one.
 *
 * A retry happens only when the line landed and the agent ignored it. The
 * moment a line is exploitable, the loop stops and scores that pair. Lines
 * that never land are not retried: another sentence has nowhere to go.
 * Scoring is `scoreScanFinding` unchanged.
 */
export async function runAdaptiveProbe(options: {
  readonly command: readonly string[];
  readonly canary: string;
  readonly rounds?: number;
  readonly timeoutMs?: number;
  readonly injectionTarget?: InjectionTarget;
  readonly generateLine?: ProbeLineGenerator;
  readonly runProbe?: ScanProbeRunner;
}): Promise<AdaptiveProbeResult> {
  const rounds = options.rounds ?? DEFAULT_ADAPTIVE_ROUNDS;
  if (rounds < 1) {
    throw new Error('rounds must be a positive integer');
  }
  const runProbe = options.runProbe ?? runScanProbe;
  const generateLine = options.generateLine ?? generateProbeLine;
  const target = options.injectionTarget ?? 'tool-result';

  const recon = await runProbe({
    guardMode: 'DETECT_ONLY',
    command: options.command,
    timeoutMs: options.timeoutMs,
  });

  const targets = recon.observedTools.filter(isSensitiveProbeTarget);
  const reports: AdaptiveToolReport[] = [];

  for (const tool of targets) {
    const previousLines: string[] = [];
    let baseline: ScanProbeResult | undefined;
    let line = '';
    let roundsUsed = 0;

    for (let round = 1; round <= rounds; round += 1) {
      line = await generateLine({
        toolName: tool.name,
        riskTier: tool.riskTier,
        description: tool.description,
        round,
        previousLines,
      });
      previousLines.push(line);
      roundsUsed = round;

      baseline = await runProbe({
        guardMode: 'DETECT_ONLY',
        command: options.command,
        timeoutMs: options.timeoutMs,
        injection: { line, canary: options.canary, target },
      });

      if (baseline.injectedInto === 'none' || isExploited(baseline)) {
        break;
      }
    }

    if (baseline === undefined) {
      throw new Error(`adaptive probe produced no run for ${tool.name}`);
    }

    const enforced = isExploited(baseline)
      ? await runProbe({
          guardMode: 'ENFORCE',
          command: options.command,
          timeoutMs: options.timeoutMs,
          injection: { line, canary: options.canary, target },
        })
      : enforcedStandIn(baseline);

    reports.push({
      toolName: tool.name,
      line,
      roundsUsed,
      finding: scoreScanFinding(
        payloadForAdaptiveLine(tool, line, roundsUsed),
        baseline,
        enforced,
      ),
    });
  }

  return {
    observedTools: recon.observedTools,
    reports: Object.freeze(reports),
  };
}
