import { describe, expect, it } from 'vitest';
import { detectExchangeWire } from './exchangeWire';

describe('detectExchangeWire', () => {
  it('detects gemini from generateContent path', () => {
    expect(detectExchangeWire({}, '/v1beta/models/gemini-pro:generateContent')).toBe(
      'gemini',
    );
  });

  it('detects gemini from contents array', () => {
    expect(
      detectExchangeWire({ contents: [{ parts: [{ text: 'hi' }] }] }, '/unknown'),
    ).toBe('gemini');
  });

  it('detects anthropic from messages path', () => {
    expect(detectExchangeWire({}, '/v1/messages')).toBe('anthropic');
  });

  it('defaults to openai for chat completions path', () => {
    expect(detectExchangeWire({}, '/v1/chat/completions')).toBe('openai');
  });
});
