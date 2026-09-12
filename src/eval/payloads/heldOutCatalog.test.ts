import { describe, expect, it } from 'vitest';
import { heldOutPayload } from './heldOutCatalog';

describe('heldOutPayload', () => {
  it('returns held-out metadata by external ref', () => {
    const payload = heldOutPayload('held_out_memory_poison');
    expect(payload?.memoryInjectionLine).toBeDefined();
    expect(payload?.expectedTools).toContain('read_memory');
  });
});
