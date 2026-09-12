import { describe, expect, it } from 'vitest';
import { formatPercent, formatRate, outcomeLabel } from './format';

describe('formatRate', () => {
  it('returns an em dash when there is no denominator', () => {
    expect(formatRate(0, 0)).toBe('—');
  });

  it('formats a dual-metric percentage to one decimal', () => {
    expect(formatRate(7, 10)).toBe('70.0%');
  });
});

describe('formatPercent', () => {
  it('formats a stored 0–1 rate', () => {
    expect(formatPercent(0.98)).toBe('98.0%');
  });
});

describe('outcomeLabel', () => {
  it('maps stored outcomes to readable words so color is never the only cue', () => {
    expect(outcomeLabel('HIJACKED')).toBe('Hijacked');
    expect(outcomeLabel('SAFE')).toBe('Safe');
  });
});
