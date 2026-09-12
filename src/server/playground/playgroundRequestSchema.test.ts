import { describe, expect, it } from 'vitest';
import { playgroundOutcome, playgroundRequestSchema } from './playgroundRequestSchema';

describe('playgroundRequestSchema', () => {
  it('accepts preset replay requests', () => {
    const parsed = playgroundRequestSchema.safeParse({
      presetId: 'direct_override',
      guardMode: 'ENFORCE',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown guard modes', () => {
    const parsed = playgroundRequestSchema.safeParse({
      presetId: 'direct_override',
      guardMode: 'DETECT_ONLY',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty preset id', () => {
    const parsed = playgroundRequestSchema.safeParse({
      presetId: '',
      guardMode: 'OFF',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('playgroundOutcome', () => {
  it('marks a stopped attack as blocked when enforce denied tools', () => {
    expect(
      playgroundOutcome({
        hijacked: false,
        guardMode: 'ENFORCE',
        blockedTools: ['send_email'],
      }),
    ).toBe('BLOCKED');
  });
});
