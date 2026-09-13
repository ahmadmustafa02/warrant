import { describe, expect, it } from 'vitest';
import { isGroqKeyRotationError, parseGroqApiKeys } from './groqKeys';

describe('parseGroqApiKeys', () => {
  it('returns a single key unchanged', () => {
    expect(parseGroqApiKeys('gsk_one')).toEqual(['gsk_one']);
  });

  it('splits comma-separated keys and trims whitespace', () => {
    expect(parseGroqApiKeys('gsk_a, gsk_b ,gsk_c')).toEqual([
      'gsk_a',
      'gsk_b',
      'gsk_c',
    ]);
  });
});

describe('isGroqKeyRotationError', () => {
  it('detects rate limits and auth failures', () => {
    expect(isGroqKeyRotationError('429 Rate limit reached')).toBe(true);
    expect(isGroqKeyRotationError('401 Invalid API Key')).toBe(true);
    expect(isGroqKeyRotationError('network timeout')).toBe(false);
  });
});
