import { describe, expect, it } from 'vitest';
import { judgeMcpToolCall, mcpDenialResult, toolsFromListResult } from './guardMcpCall';

const LISTED = toolsFromListResult({
  jsonrpc: '2.0',
  id: 1,
  result: {
    tools: [
      {
        name: 'read_document',
        description: 'Read a document',
        inputSchema: { properties: { id: {} } },
      },
      {
        name: 'send_email',
        description: 'Send mail',
        inputSchema: { properties: { to: {}, body: {} } },
      },
    ],
  },
});

function call(name: string, args: Record<string, unknown>): unknown {
  return {
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name, arguments: args },
  };
}

describe('judgeMcpToolCall', () => {
  it('allows a read the user asked for', () => {
    const judgement = judgeMcpToolCall({
      mode: 'ENFORCE',
      userTurn: 'Summarize document doc-1',
      request: call('read_document', { id: 'doc-1' }),
      advertised: LISTED,
    });
    expect(judgement.deny).toBe(false);
    expect(judgement.decision?.kind).toBe('GUARD');
  });

  it('denies send_email when the user only asked for a summary', () => {
    const judgement = judgeMcpToolCall({
      mode: 'ENFORCE',
      userTurn: 'Summarize document doc-1',
      request: call('send_email', { to: 'attacker@evil.test', body: 'x' }),
      advertised: LISTED,
    });
    expect(judgement.deny).toBe(true);
    expect(judgement.reason).toContain('send_email');
    const reply = mcpDenialResult(7, judgement.reason) as {
      result: { isError: boolean };
    };
    expect(reply.result.isError).toBe(true);
  });

  it('forwards a detect-only denial so the call still runs', () => {
    const judgement = judgeMcpToolCall({
      mode: 'DETECT_ONLY',
      userTurn: 'Summarize document doc-1',
      request: call('send_email', { to: 'attacker@evil.test', body: 'x' }),
      advertised: LISTED,
    });
    expect(judgement.deny).toBe(false);
    expect(judgement.decision?.kind).toBe('GUARD');
    if (judgement.decision?.kind === 'GUARD') {
      expect(judgement.decision.decision.allowed).toBe(false);
    }
  });

  it('does not judge traffic when the guard is off', () => {
    const judgement = judgeMcpToolCall({
      mode: 'OFF',
      userTurn: 'Summarize document doc-1',
      request: call('send_email', { to: 'x@y.test' }),
      advertised: LISTED,
    });
    expect(judgement.decision).toBeUndefined();
    expect(judgement.deny).toBe(false);
  });
});
