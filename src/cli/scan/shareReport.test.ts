import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { BenignSummary } from './benignTasks';
import type { ScanFinding, ScanSummary } from './scanFindings';
import {
  buildPublicScanReport,
  encodeReportFragment,
  publicScanReportSchema,
  reportPageUrl,
} from './shareReport';

const summary: ScanSummary = {
  payloads: 2,
  reachable: 2,
  exploitable: 1,
  protectedCount: 1,
  vulnerable: 0,
  attackStopRate: 1,
};

const benign: BenignSummary = {
  passed: 1,
  total: 1,
  passRate: 1,
  tasks: [
    {
      task: 'Summarize document doc-1',
      passed: true,
      blockedTools: [],
      exitCode: 0,
      timedOut: false,
    },
  ],
};

const finding: ScanFinding = {
  payloadId: 'direct',
  category: 'direct',
  severity: 'HIGH',
  verdict: 'protected',
  attemptedTools: ['send_email'],
  blockedTools: ['send_email'],
  leakedUnguarded: true,
  leakedUnderGuard: false,
};

describe('buildPublicScanReport', () => {
  it('keeps both rates and drops the canary', () => {
    const report = buildPublicScanReport({
      mode: 'full',
      agent: 'node agent.js WARRANT-SCAN-CANARY-TEST',
      at: '2026-09-29T12:00:00.000Z',
      canary: 'WARRANT-SCAN-CANARY-TEST',
      summary,
      benign,
      findings: [finding],
      byShape: [
        {
          shape: 'direct',
          trials: 1,
          exploitable: 1,
          protectedCount: 1,
          vulnerable: 0,
          attackStopRate: 1,
        },
      ],
    });

    expect(report.summary.attackStopRate).toBe(1);
    expect(report.benign.passRate).toBe(1);
    expect(report.agent).toBe('node agent.js [canary]');
    expect(JSON.stringify(report)).not.toContain('WARRANT-SCAN-CANARY-TEST');
    expect(report.findings[0]?.tools).toEqual(['send_email']);
  });

  it('encodes a fragment the report page can inflate', async () => {
    const report = buildPublicScanReport({
      mode: 'corpus',
      agent: 'node agent.js',
      at: '2026-09-29T12:00:00.000Z',
      summary: { ...summary, attackStopRate: undefined },
      benign,
      findings: [finding],
    });
    const fragment = encodeReportFragment(report);
    const json = inflateRawSync(Buffer.from(fragment, 'base64url')).toString('utf8');
    expect(publicScanReportSchema.parse(JSON.parse(json))).toEqual(report);

    const bytes = Uint8Array.from(Buffer.from(fragment, 'base64url'));
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    const text = await new Response(stream).text();
    expect(publicScanReportSchema.parse(JSON.parse(text)).mode).toBe('corpus');

    const url = reportPageUrl('https://warrant-lab.vercel.app/', report);
    expect(url.startsWith('https://warrant-lab.vercel.app/report#')).toBe(true);
    expect(url.length).toBeLessThan(4000);
  });
});
