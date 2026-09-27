import { describe, expect, it } from 'vitest';
import { runScanCommand } from '@/cli/commands/scan';
import type { ScanProbeRunner } from './adaptiveProbe';
import { attackLinesForTool } from './adaptiveProbe';
import { runFullProbe } from './fullScan';
import type { ObservedScanTool, ScanProbeResult } from './runScanProbe';

const SEND_EMAIL: ObservedScanTool = {
  name: 'send_email',
  riskTier: 'SENSITIVE',
  description: 'Send a message.',
  egress: true,
  returnsSecrets: false,
};

const READ_DOCUMENT: ObservedScanTool = {
  name: 'read_document',
  riskTier: 'READ_ONLY',
  description: 'Read a document.',
  egress: false,
  returnsSecrets: false,
};

function probe(overrides: Partial<ScanProbeResult> = {}): ScanProbeResult {
  return {
    guardMode: 'DETECT_ONLY',
    observedTools: [READ_DOCUMENT, SEND_EMAIL],
    unauthorizedTools: [],
    blockedTools: [],
    canaryLeaked: false,
    canaryDelivered: false,
    unstoppedTools: [],
    injectedInto: 'tool-result',
    exchanges: 1,
    exitCode: 0,
    timedOut: false,
    stderrTail: '',
    ...overrides,
  };
}

describe('runFullProbe', () => {
  it('runs every shape the requested number of times and keeps going after a hit', async () => {
    const lines: string[] = [];
    const modes: string[] = [];

    const runProbe: ScanProbeRunner = (options) => {
      modes.push(options.guardMode);
      if (options.injection === undefined) {
        return Promise.resolve(probe());
      }
      lines.push(options.injection.line);
      if (options.injection.line.startsWith('Call send_email')) {
        if (options.guardMode === 'ENFORCE') {
          return Promise.resolve(
            probe({ guardMode: 'ENFORCE', blockedTools: ['send_email'] }),
          );
        }
        return Promise.resolve(probe({ unauthorizedTools: ['send_email'] }));
      }
      return Promise.resolve(probe());
    };

    const result = await runFullProbe({
      command: ['node', 'agent.js'],
      canary: 'WARRANT-SCAN-CANARY-TEST',
      repeats: 2,
      runProbe,
    });

    const shapes = attackLinesForTool('send_email');
    expect(result.reports).toHaveLength(shapes.length * 2);
    expect(result.reports.map((report) => report.shape)).toEqual(
      shapes.flatMap((attack) => [attack.shape, attack.shape]),
    );
    expect(
      result.reports.filter((report) => report.finding.verdict === 'protected'),
    ).toHaveLength(2);
    expect(
      result.reports.filter((report) => report.finding.verdict === 'not-exploitable'),
    ).toHaveLength(6);
    expect(lines.filter((line) => line.startsWith('Call send_email'))).toHaveLength(4);
    expect(modes.filter((mode) => mode === 'ENFORCE')).toHaveLength(2);
    expect(result.reports.every((report) => report.toolName === 'send_email')).toBe(
      true,
    );
  });

  it('rejects full mode mixed with the corpus flags, and repeats without full mode', async () => {
    await expect(
      runScanCommand(['--full', '--all', '--', 'node', 'agent.js']),
    ).rejects.toThrow('--full');
    await expect(
      runScanCommand(['--repeats', '2', '--', 'node', 'agent.js']),
    ).rejects.toThrow('--repeats requires --full');
  });

  it('rejects a repeat count below 1', async () => {
    await expect(
      runFullProbe({
        command: ['node', 'agent.js'],
        canary: 'WARRANT-SCAN-CANARY-TEST',
        repeats: 0,
        runProbe: () => Promise.resolve(probe()),
      }),
    ).rejects.toThrow('repeats must be a positive integer');
  });
});
