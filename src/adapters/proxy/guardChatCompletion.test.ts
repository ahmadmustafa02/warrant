import { describe, expect, it } from 'vitest';
import { requestUsesStream } from './exchangeWire';
import { guardChatCompletion } from './guardChatCompletion';

describe('requestUsesStream', () => {
  it('detects stream: true', () => {
    expect(
      requestUsesStream({ model: 'x', messages: [], stream: true }, 'openai'),
    ).toBe(true);
  });
});

describe('guardChatCompletion', () => {
  it('rejects streaming requests in ENFORCE without calling upstream', async () => {
    await expect(
      guardChatCompletion({
        mode: 'ENFORCE',
        streaming: 'block',
        upstreamUrl: 'http://127.0.0.1:9/chat/completions',
        upstreamHeaders: {},
        requestBody: {
          model: 'x',
          messages: [{ role: 'user', content: 'hi' }],
          stream: true,
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
