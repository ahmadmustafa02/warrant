import { describe, expect, it } from 'vitest';
import { taint } from '../provenance/tainted';
import { ToolRegistry, type ToolDefinition } from '../tools/registry';
import { decideToolCall, type ProposedToolCall } from './decide';
import { issueWarrant, type UserIntent, type Warrant } from './warrant';

const tools: readonly ToolDefinition[] = [
  { name: 'read_document', riskTier: 'READ_ONLY', description: 'Reads a document.' },
  {
    name: 'send_email',
    riskTier: 'SENSITIVE',
    description: 'Sends an email.',
    authorityParameters: ['to'],
  },
  {
    name: 'delete_account',
    riskTier: 'DESTRUCTIVE',
    description: 'Deletes an account.',
  },
];

const registry = new ToolRegistry(tools);
const clock = (): Date => new Date('2026-09-12T00:00:00.000Z');

function warrantFor(intent: UserIntent): Warrant {
  return issueWarrant(taint(intent, 'USER'), registry, clock);
}

function decide(warrant: Warrant, call: ProposedToolCall) {
  return decideToolCall({ warrant, registry, call });
}

describe('decideToolCall', () => {
  it('refuses a tool it has never heard of', () => {
    const decision = decide(warrantFor({ requestedTools: [] }), {
      tool: 'wire_funds',
      args: {},
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe('UNKNOWN_TOOL');
  });

  it('allows a read even when the arguments came from untrusted content', () => {
    // Read-only tools are why the benign-pass rate survives.
    const decision = decide(warrantFor({ requestedTools: [] }), {
      tool: 'read_document',
      args: { id: taint('doc-1', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.allowed === true && decision.authorizedBy).toBe('RISK_TIER');
  });

  it('blocks a sensitive action the user never authorized', () => {
    // The canonical hijack: the document told the agent to email the attacker.
    const decision = decide(warrantFor({ requestedTools: ['read_document'] }), {
      tool: 'send_email',
      args: { to: taint('attacker@evil.test', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe('NO_WARRANT_FOR_TOOL');
  });

  it('blocks a destructive action the user never authorized', () => {
    const decision = decide(warrantFor({ requestedTools: ['read_document'] }), {
      tool: 'delete_account',
      args: { id: taint('acct-9', 'MEMORY') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe('NO_WARRANT_FOR_TOOL');
  });

  it('allows an authorized action whose parameters came from a document', () => {
    // This is the distinction that makes the guard usable rather than paranoid:
    // content filling in details is legitimate, expanding capabilities is not.
    const decision = decide(warrantFor({ requestedTools: ['send_email'] }), {
      tool: 'send_email',
      args: {
        to: taint('bob@example.com', 'USER'),
        body: taint('summary drawn from the document', 'TOOL_RESULT'),
      },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.allowed === true && decision.authorizedBy).toBe('USER_WARRANT');
    expect(decision.taintSources).toEqual(['USER', 'TOOL_RESULT']);
  });

  it('blocks a redirected recipient when the user pinned it', () => {
    const warrant = warrantFor({
      requestedTools: ['send_email'],
      pinnedParameters: { send_email: { to: 'bob@example.com' } },
    });
    const decision = decide(warrant, {
      tool: 'send_email',
      args: { to: taint('attacker@evil.test', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'PINNED_PARAMETER_CONFLICT',
    );
    expect(decision.reason).toContain('bob@example.com');
  });

  it('allows the pinned value when the call honours it', () => {
    const warrant = warrantFor({
      requestedTools: ['send_email'],
      pinnedParameters: { send_email: { to: 'bob@example.com' } },
    });
    const decision = decide(warrant, {
      tool: 'send_email',
      args: { to: taint('bob@example.com', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(true);
  });

  it('leaves an omitted pinned parameter to the tool own validation', () => {
    const warrant = warrantFor({
      requestedTools: ['delete_account'],
      pinnedParameters: { delete_account: { id: 'acct-1' } },
    });
    const decision = decide(warrant, {
      tool: 'delete_account',
      args: { reason: taint('cleanup', 'USER') },
    });
    // Failing to supply an ordinary argument is not an escalation.
    expect(decision.allowed).toBe(true);
  });

  it('refuses to let a tool default choose a pinned authority parameter', () => {
    const warrant = warrantFor({
      requestedTools: ['send_email'],
      pinnedParameters: { send_email: { to: 'bob@example.com' } },
    });
    const decision = decide(warrant, {
      tool: 'send_email',
      args: { body: taint('hello', 'USER') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'AUTHORITY_PARAMETER_MISSING',
    );
  });

  it('allows an authority parameter that came straight from the user', () => {
    const decision = decide(warrantFor({ requestedTools: ['send_email'] }), {
      tool: 'send_email',
      args: {
        to: taint('bob@example.com', 'USER'),
        body: taint('summary from the document', 'TOOL_RESULT'),
      },
    });
    expect(decision.allowed).toBe(true);
  });

  it('reports risk tier and taint on a denial so traces explain themselves', () => {
    const decision = decide(warrantFor({ requestedTools: [] }), {
      tool: 'send_email',
      args: { to: taint('attacker@evil.test', 'WORKER') },
    });
    expect(decision.riskTier).toBe('SENSITIVE');
    expect(decision.taintSources).toEqual(['WORKER']);
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it('blocks a recipient chosen by untrusted content when the user did not pin it', () => {
    const decision = decide(warrantFor({ requestedTools: ['send_email'] }), {
      tool: 'send_email',
      args: {
        to: taint('attacker@evil.test', 'TOOL_RESULT'),
        body: taint('summary', 'TOOL_RESULT'),
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'AUTHORITY_PARAMETER_FROM_CONTENT',
    );
  });

  it('compares non-string pinned arguments by their serialized form', () => {
    const warrant = warrantFor({
      requestedTools: ['send_email'],
      pinnedParameters: { send_email: { to: '42' } },
    });
    const decision = decide(warrant, {
      tool: 'send_email',
      args: { to: taint(42, 'USER') },
    });
    expect(decision.allowed).toBe(true);
  });
});
