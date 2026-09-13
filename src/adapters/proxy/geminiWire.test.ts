import { describe, expect, it } from 'vitest';
import {
  parseGeminiRequest,
  parseGeminiToolCalls,
  stripDeniedGeminiFunctionCalls,
} from './geminiWire';

describe('geminiWire', () => {
  it('parses user text and tool declarations', () => {
    const request = parseGeminiRequest({
      contents: [{ role: 'user', parts: [{ text: 'Summarize doc-1' }] }],
      tools: [
        {
          functionDeclarations: [
            { name: 'read_document', description: 'Read a doc' },
            { name: 'send_email', description: 'Send mail' },
          ],
        },
      ],
    });
    expect(request.userRequest).toContain('Summarize');
    expect(request.tools).toHaveLength(2);
    expect(request.tools[0]?.name).toBe('read_document');
    expect(request.tools[1]?.name).toBe('send_email');
  });

  it('parses functionCall parts and strips denied names', () => {
    const raw = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'send_email',
                  args: { to: 'attacker@evil.test' },
                },
              },
              { text: 'Done.' },
            ],
          },
        },
      ],
    };
    const calls = parseGeminiToolCalls(raw);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('send_email');

    const stripped = stripDeniedGeminiFunctionCalls(
      raw,
      new Map([['gemini_call_0', 'denied']]),
    ) as typeof raw;
    const parts = stripped.candidates?.[0]?.content?.parts ?? [];
    expect(parts.some((p) => 'functionCall' in p)).toBe(false);
    expect(parts.some((p) => 'text' in p && p.text === 'Done.')).toBe(true);
  });
});
