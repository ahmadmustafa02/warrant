import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatMs,
  formatPercent,
  formatRate,
  guardModeLabel,
  outcomeLabel,
} from './format';

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
    expect(outcomeLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('guardModeLabel', () => {
  it('maps guard modes for the dashboard', () => {
    expect(guardModeLabel('ENFORCE')).toBe('Enforce');
    expect(guardModeLabel('CUSTOM')).toBe('CUSTOM');
  });
});

describe('formatMs', () => {
  it('formats sub-second and second-scale latencies', () => {
    expect(formatMs(250)).toBe('250 ms');
    expect(formatMs(2500)).toBe('2.5 s');
  });
});

describe('formatDateTime', () => {
  it('formats ISO timestamps', () => {
    expect(formatDateTime('2026-09-12T12:00:00.000Z')).toMatch(/2026/);
  });
});
