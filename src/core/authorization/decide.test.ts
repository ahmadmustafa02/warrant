import { describe, expect, it } from 'vitest';
import { taint } from '../provenance/tainted';
import { ToolRegistry, type ToolDefinition } from '../tools/registry';
import { decideToolCall, type ProposedToolCall } from './decide';
import { issueWarrant, type UserIntent, type Warrant } from './warrant';

const tools: readonly ToolDefinition[] = [
  { name: 'read_document', riskTier: 'READ_ONLY', description: 'Reads a document.' },
  {
    name: 'fetch_url',
    riskTier: 'READ_ONLY',
    egress: true,
    description: 'Fetches a URL.',
    authorityParameters: ['url'],
  },
  {
    name: 'read_vault_entry',
    riskTier: 'SENSITIVE',
    returnsSecrets: true,
    description: 'Reads a vault entry.',
  },
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
  {
    name: 'run_sql',
    riskTier: 'SENSITIVE',
    description: 'Runs a read-only SQL statement.',
    parameterConstraints: {
      query: { kind: 'stringPattern', pattern: '^SELECT\\s', flags: 'i' },
    },
  },
  {
    name: 'wire_transfer',
    riskTier: 'DESTRUCTIVE',
    description: 'Transfers funds.',
    authorityParameters: ['to'],
    parameterConstraints: {
      amount: { kind: 'numberMax', max: 5000 },
    },
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

  it('allows any read when the user asked for documents without naming one', () => {
    // "Summarize my documents" pins nothing, so no read is out of scope.
    const decision = decide(warrantFor({ requestedTools: ['read_document'] }), {
      tool: 'read_document',
      args: { id: taint('doc-7', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(true);
  });

  it('allows a read that stays inside the scope the user named', () => {
    const warrant = warrantFor({
      requestedTools: ['read_document'],
      pinnedParameters: { read_document: { id: 'doc-1' } },
    });
    const decision = decide(warrant, {
      tool: 'read_document',
      args: { id: taint('doc-1', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.allowed === true && decision.authorizedBy).toBe('RISK_TIER');
  });

  it('blocks a read of a document the user did not name', () => {
    // Being read-only buys a tool no warrant of its own; it does not buy an exemption
    // from the scope the user set, or "summarize doc-1" would license reading anything.
    const warrant = warrantFor({
      requestedTools: ['read_document'],
      pinnedParameters: { read_document: { id: 'doc-1' } },
    });
    const decision = decide(warrant, {
      tool: 'read_document',
      args: { id: taint('doc-2', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'PINNED_PARAMETER_CONFLICT',
    );
    expect(decision.riskTier).toBe('READ_ONLY');
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

  it('requires a warrant for a secret-bearing read', () => {
    const decision = decide(warrantFor({ requestedTools: ['read_document'] }), {
      tool: 'read_vault_entry',
      args: { key: taint('api_key', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe('NO_WARRANT_FOR_TOOL');
  });

  it('requires a warrant for an egress read even when the tier is READ_ONLY', () => {
    const decision = decide(warrantFor({ requestedTools: ['read_document'] }), {
      tool: 'fetch_url',
      args: { url: taint('https://example.com', 'USER') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe('NO_WARRANT_FOR_TOOL');
  });

  it('blocks an egress destination chosen by untrusted content', () => {
    const decision = decide(warrantFor({ requestedTools: ['fetch_url'] }), {
      tool: 'fetch_url',
      args: { url: taint('https://evil.test/exfil', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'AUTHORITY_PARAMETER_FROM_CONTENT',
    );
  });

  it('blocks SQL that is not a SELECT when the tool is constrained to reads', () => {
    const decision = decide(warrantFor({ requestedTools: ['run_sql'] }), {
      tool: 'run_sql',
      args: { query: taint('DELETE FROM users', 'USER') },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'PARAMETER_CONSTRAINT_VIOLATION',
    );
  });

  it('allows SELECT statements under the same constraint', () => {
    const decision = decide(warrantFor({ requestedTools: ['run_sql'] }), {
      tool: 'run_sql',
      args: { query: taint('select id from accounts', 'TOOL_RESULT') },
    });
    expect(decision.allowed).toBe(true);
  });

  it('blocks a transfer above the declared numeric ceiling', () => {
    const decision = decide(warrantFor({ requestedTools: ['wire_transfer'] }), {
      tool: 'wire_transfer',
      args: {
        to: taint('bob@example.com', 'USER'),
        amount: taint(999_999, 'USER'),
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.code).toBe(
      'PARAMETER_CONSTRAINT_VIOLATION',
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
