import { describe, expect, it } from 'vitest';
import {
  assembleOpenAiCompletionFromSse,
  chatCompletionToOpenAiSse,
  openAiCompletionToChatResponse,
} from './openAiStreamGuard';

describe('assembleOpenAiCompletionFromSse', () => {
  it('merges tool call deltas', () => {
    const sse = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"send_email","arguments":"{\\"to\\":"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"a@b.com\\"}"}}]}}]}',
      'data: [DONE]',
    ].join('\n');

    const assembled = assembleOpenAiCompletionFromSse(sse);
    expect(assembled.message.tool_calls?.[0]?.function.name).toBe('send_email');
    expect(assembled.message.tool_calls?.[0]?.function.arguments).toContain('a@b.com');
  });

  it('round-trips through guarded SSE encoder', () => {
    const assembled = assembleOpenAiCompletionFromSse(
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n',
    );
    const body = openAiCompletionToChatResponse(assembled);
    const sse = chatCompletionToOpenAiSse(body);
    expect(sse).toContain('[DONE]');
    expect(sse).toContain('"content":"hi"');
  });
});
