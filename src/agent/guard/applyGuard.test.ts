import { describe, expect, it } from 'vitest';
import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import { createSandboxRegistry } from '../sandbox/tools';
import { denialMessage, evaluateToolCall } from './applyGuard';

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
});
