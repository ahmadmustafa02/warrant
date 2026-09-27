import { describe, expect, it } from 'vitest';
import { augmentIntentWithTool, isApprovalEligible } from './proxyApproval';
import type { DeniedDecision } from '@/core/authorization/decide';

function denied(
  partial: Partial<DeniedDecision> & Pick<DeniedDecision, 'code'>,
): DeniedDecision {
  return {
    allowed: false,
    tool: 'send_email',
    riskTier: 'DESTRUCTIVE',
    taintSources: [],
    reason: 'test',
    ...partial,
  };
}

describe('isApprovalEligible', () => {
  it('rejects authority smuggled from content', () => {
    expect(
      isApprovalEligible(
        denied({
          code: 'AUTHORITY_PARAMETER_FROM_CONTENT',
          tool: 'send_email',
        }),
      ),
    ).toBe(false);
  });

  it('rejects a link that is carrying a secret', () => {
    expect(
      isApprovalEligible(denied({ code: 'SECRET_IN_LINK', riskTier: 'SENSITIVE' })),
    ).toBe(false);
  });

  it('asks when a recipient cannot be traced, and still rejects one taken from content', () => {
    expect(
      isApprovalEligible(
        denied({ code: 'DESTINATION_ORIGIN_UNCLEAR', riskTier: 'SENSITIVE' }),
      ),
    ).toBe(true);
    expect(
      isApprovalEligible(
        denied({
          code: 'AUTHORITY_PARAMETER_FROM_CONTENT',
          riskTier: 'SENSITIVE',
        }),
      ),
    ).toBe(false);
  });

  it('allows destructive scope escalation prompts', () => {
    expect(
      isApprovalEligible(
        denied({ code: 'NO_WARRANT_FOR_TOOL', riskTier: 'DESTRUCTIVE' }),
      ),
    ).toBe(true);
  });
});

describe('augmentIntentWithTool', () => {
  it('adds a tool once', () => {
    const next = augmentIntentWithTool(
      { requestedTools: ['read_document'] },
      'send_email',
    );
    expect(next.requestedTools).toEqual(['read_document', 'send_email']);
  });
});
