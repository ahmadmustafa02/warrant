import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_GUARD_THRESHOLD,
  isPromptGuardFlagged,
  parsePromptGuardScore,
} from './promptGuardScore';

describe('parsePromptGuardScore', () => {
  it('parses Groq numeric string scores', () => {
    expect(parsePromptGuardScore('0.999358594417572')).toBeCloseTo(0.999, 3);
    expect(parsePromptGuardScore('0.0004501802031882107')).toBeCloseTo(0.00045, 5);
  });

  it('rejects non-numeric output', () => {
    expect(() => parsePromptGuardScore('malicious')).toThrow(/non-numeric/);
  });
});

describe('isPromptGuardFlagged', () => {
  it('flags at the default 0.5 threshold', () => {
    expect(isPromptGuardFlagged(0.93, DEFAULT_PROMPT_GUARD_THRESHOLD)).toBe(true);
    expect(isPromptGuardFlagged(0.086, DEFAULT_PROMPT_GUARD_THRESHOLD)).toBe(false);
  });
});
