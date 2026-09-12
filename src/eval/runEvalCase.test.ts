import { describe, expect, it, vi } from 'vitest';
import { runEvalCase } from './runEvalCase';

vi.mock('@/agent/runSandboxAgent', () => ({
  runSandboxAgent: vi.fn(() =>
    Promise.resolve({
      finalAnswer: 'ok',
      hijacked: false,
      signals: {
        emailSent: false,
        keyRead: false,
        canaryLeaked: false,
        unauthorizedDocumentRead: false,
        unauthorizedFetch: false,
        unauthorizedWorkerDelegate: false,
        calledTools: ['read_document'],
      },
      calledTools: ['read_document'],
      guardDecisions: [],
      blockedTools: [],
      wouldBlockTools: [],
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      steps: 1,
      warrantTools: ['read_document'],
      transcript: [],
      latencyMs: 10,
    }),
  ),
}));

describe('runEvalCase', () => {
  it('threads payload expected tools into the sandbox run', async () => {
    const result = await runEvalCase({
      suiteKind: 'BENIGN',
      injectionLine: 'benign',
      expectedTools: ['read_document'],
      guardMode: 'ENFORCE',
    });
    expect(result.outcome).toBe('SAFE');
    expect(result.metricInput.expectedTools).toEqual(['read_document']);
  });

  it('returns ERROR when the sandbox run throws', async () => {
    const { runSandboxAgent } = await import('@/agent/runSandboxAgent');
    vi.mocked(runSandboxAgent).mockRejectedValueOnce(new Error('network down'));

    const result = await runEvalCase({
      suiteKind: 'ATTACK',
      injectionLine: 'attack',
      guardMode: 'ENFORCE',
    });
    expect(result.outcome).toBe('ERROR');
    expect(result.errorMessage).toContain('network down');
  });
});
