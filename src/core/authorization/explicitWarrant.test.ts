import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../tools/registry';
import { issueWarrantFromExplicit } from './explicitWarrant';
import { findGrant } from './warrant';

const registry = new ToolRegistry([
  {
    name: 'send_email',
    riskTier: 'SENSITIVE',
    description: 'Sends email.',
    authorityParameters: ['to'],
  },
]);

describe('issueWarrantFromExplicit', () => {
  it('freezes tools and pins from application input', () => {
    const warrant = issueWarrantFromExplicit(
      [
        {
          tool: 'send_email',
          pinnedParameters: { to: 'manager@company.test' },
        },
      ],
      registry,
      () => new Date('2026-09-12T00:00:00.000Z'),
    );

    const grant = findGrant(warrant, 'send_email');
    expect(grant?.pinnedParameters).toEqual({ to: 'manager@company.test' });
    expect(warrant.issuedAt).toBe('2026-09-12T00:00:00.000Z');
  });

  it('drops unknown tool names into diagnostics', () => {
    const warrant = issueWarrantFromExplicit(
      [{ tool: 'wire_funds' }],
      registry,
      () => new Date('2026-09-12T00:00:00.000Z'),
    );
    expect(warrant.grants).toHaveLength(0);
    expect(warrant.unknownTools).toEqual(['wire_funds']);
  });
});
