import { describe, expect, it } from 'vitest';
import { taint } from '../provenance/tainted';
import { ToolRegistry, type ToolDefinition } from '../tools/registry';
import {
  WarrantIssuanceError,
  findGrant,
  issueWarrant,
  type Grant,
  type UserIntent,
} from './warrant';

const tools: readonly ToolDefinition[] = [
  { name: 'read_document', riskTier: 'READ_ONLY', description: 'Reads a document.' },
  { name: 'send_email', riskTier: 'SENSITIVE', description: 'Sends an email.' },
  {
    name: 'delete_account',
    riskTier: 'DESTRUCTIVE',
    description: 'Deletes an account.',
  },
];

function registry(): ToolRegistry {
  return new ToolRegistry(tools);
}

const fixedClock = (): Date => new Date('2026-09-12T00:00:00.000Z');

describe('issueWarrant', () => {
  it('grants the tools the user asked for', () => {
    const intent = taint<UserIntent>(
      { requestedTools: ['read_document', 'send_email'] },
      'USER',
    );
    const warrant = issueWarrant(intent, registry(), fixedClock);
    expect(warrant.grants.map((grant) => grant.tool)).toEqual([
      'read_document',
      'send_email',
    ]);
    expect(warrant.issuedAt).toBe('2026-09-12T00:00:00.000Z');
  });

  it('refuses to issue a warrant from untrusted content', () => {
    // The single most important property: a poisoned document cannot mint permissions.
    const intent = taint<UserIntent>(
      { requestedTools: ['delete_account'] },
      'TOOL_RESULT',
    );
    expect(() => issueWarrant(intent, registry(), fixedClock)).toThrow(
      WarrantIssuanceError,
    );
  });

  it('refuses intent that is only partly user-authored', () => {
    const intent = taint<UserIntent>(
      { requestedTools: ['send_email'] },
      'USER',
      'MEMORY',
    );
    expect(() => issueWarrant(intent, registry(), fixedClock)).toThrow(
      WarrantIssuanceError,
    );
  });

  it('names the offending provenance in the error so traces are explainable', () => {
    const intent = taint<UserIntent>({ requestedTools: [] }, 'WORKER');
    expect(() => issueWarrant(intent, registry(), fixedClock)).toThrow(/WORKER/);
  });

  it('records requested names that match no registered tool', () => {
    const intent = taint<UserIntent>(
      { requestedTools: ['send_email', 'wire_funds'] },
      'USER',
    );
    const warrant = issueWarrant(intent, registry(), fixedClock);
    expect(warrant.unknownTools).toEqual(['wire_funds']);
    expect(warrant.grants).toHaveLength(1);
  });

  it('collapses duplicate requests into a single grant', () => {
    const intent = taint<UserIntent>(
      { requestedTools: ['send_email', 'send_email'] },
      'USER',
    );
    expect(issueWarrant(intent, registry(), fixedClock).grants).toHaveLength(1);
  });

  it('attaches the parameters the user pinned', () => {
    const intent = taint<UserIntent>(
      {
        requestedTools: ['send_email'],
        pinnedParameters: { send_email: { to: 'bob@example.com' } },
      },
      'USER',
    );
    const warrant = issueWarrant(intent, registry(), fixedClock);
    expect(warrant.grants[0]?.pinnedParameters).toEqual({ to: 'bob@example.com' });
  });

  it('defaults to no pinned parameters when the user named none', () => {
    const intent = taint<UserIntent>({ requestedTools: ['send_email'] }, 'USER');
    expect(
      issueWarrant(intent, registry(), fixedClock).grants[0]?.pinnedParameters,
    ).toEqual({});
  });

  it('stamps issuance time from the real clock by default', () => {
    const intent = taint<UserIntent>({ requestedTools: [] }, 'USER');
    const warrant = issueWarrant(intent, registry());
    expect(Number.isNaN(Date.parse(warrant.issuedAt))).toBe(false);
  });

  it('freezes the warrant so later injected text has nothing to edit', () => {
    const intent = taint<UserIntent>({ requestedTools: ['send_email'] }, 'USER');
    const warrant = issueWarrant(intent, registry(), fixedClock);

    expect(() => {
      (warrant.grants as Grant[]).push({
        tool: 'delete_account',
        pinnedParameters: {},
      });
    }).toThrow(TypeError);
    expect(() => {
      (warrant.grants[0] as { tool: string }).tool = 'delete_account';
    }).toThrow(TypeError);
    expect(() => {
      (warrant.grants[0]?.pinnedParameters as Record<string, string>)['to'] =
        'attacker@evil.test';
    }).toThrow(TypeError);
  });
});

describe('findGrant', () => {
  it('finds a granted tool and misses an ungranted one', () => {
    const intent = taint<UserIntent>({ requestedTools: ['send_email'] }, 'USER');
    const warrant = issueWarrant(intent, registry(), fixedClock);
    expect(findGrant(warrant, 'send_email')?.tool).toBe('send_email');
    expect(findGrant(warrant, 'delete_account')).toBeUndefined();
  });
});
