import { describe, expect, it } from 'vitest';
import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import { createSandboxRegistry } from '../sandbox/tools';
import type { DeniedDecision } from '@/core/authorization/decide';
import {
  denialMessage,
  evaluateToolCall,
  guardWouldDeny,
  parseToolArguments,
  shouldBlockToolCall,
} from './applyGuard';

describe('shouldBlockToolCall', () => {
  const denial: DeniedDecision = {
    allowed: false,
    tool: 'send_email',
    riskTier: 'SENSITIVE',
    code: 'NO_WARRANT_FOR_TOOL',
    taintSources: ['WORKER'],
    reason: 'denied',
  };

  it('blocks only in ENFORCE', () => {
    expect(shouldBlockToolCall('ENFORCE', denial)).toBe(true);
    expect(shouldBlockToolCall('DETECT_ONLY', denial)).toBe(false);
    expect(shouldBlockToolCall('OFF', null)).toBe(false);
  });

  it('detects would-deny for DETECT_ONLY', () => {
    expect(guardWouldDeny(denial)).toBe(true);
    expect(guardWouldDeny(null)).toBe(false);
  });
});

describe('parseToolArguments', () => {
  it('treats empty raw arguments as an empty object', () => {
    expect(parseToolArguments('')).toEqual({});
  });

  it('rejects non-object JSON', () => {
    expect(() => parseToolArguments('[]')).toThrow(/JSON object/);
  });
});

describe('evaluateToolCall', () => {
  const registry = createSandboxRegistry();

  it('returns null when the guard is off', () => {
    const warrant = issueWarrant(
      taint({ requestedTools: ['read_document'] }, 'USER'),
      registry,
    );
    const decision = evaluateToolCall({
      mode: 'OFF',
      warrant,
      registry,
      toolName: 'send_email',
      rawArguments: '{"to":"evil@test.com","body":"x"}',
    });
    expect(decision).toBeNull();
  });

  it('blocks send_email when only read_document was authorized', () => {
    const warrant = issueWarrant(
      taint({ requestedTools: ['read_document'] }, 'USER'),
      registry,
    );
    const decision = evaluateToolCall({
      mode: 'ENFORCE',
      warrant,
      registry,
      toolName: 'send_email',
      rawArguments: '{"to":"evil@test.com","body":"x"}',
    });
    expect(decision?.allowed).toBe(false);
    if (decision && !decision.allowed) {
      expect(denialMessage(decision)).toContain('guard_denied');
    } else {
      expect.fail('expected a denial decision');
    }
  });

  it('returns an empty denial message for allowed decisions', () => {
    const warrant = issueWarrant(
      taint({ requestedTools: ['read_document'] }, 'USER'),
      registry,
    );
    const decision = evaluateToolCall({
      mode: 'ENFORCE',
      warrant,
      registry,
      toolName: 'read_document',
      rawArguments: '{"id":"doc-1"}',
    });
    expect(decision?.allowed).toBe(true);
    if (decision) {
      expect(denialMessage(decision)).toBe('');
    }
  });
});
