import { describe, expect, it } from 'vitest';
import { observeToolResults } from './observeToolResults';

describe('observeToolResults', () => {
  it('pairs an OpenAI tool message with the call that produced it', () => {
    const observed = observeToolResults(
      {
        messages: [
          { role: 'user', content: 'Email Ali' },
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                function: { name: 'lookup_contact', arguments: '{"name":"Ali"}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'call_1',
            content: '{"email":"ali@gmail.com"}',
          },
        ],
      },
      'openai',
    );

    expect(observed).toEqual([
      {
        toolName: 'lookup_contact',
        argumentsText: '{"name":"Ali"}',
        outputText: '{"email":"ali@gmail.com"}',
      },
    ]);
  });

  it('pairs a Responses function_call_output with its function_call', () => {
    const observed = observeToolResults(
      {
        input: [
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'read_document',
            arguments: '{}',
          },
          {
            type: 'function_call_output',
            call_id: 'call_1',
            output: 'see ahmad@gmail.com',
          },
        ],
      },
      'openai-responses',
    );

    expect(observed[0]?.toolName).toBe('read_document');
    expect(observed[0]?.outputText).toBe('see ahmad@gmail.com');
  });

  it('pairs Anthropic tool_result blocks and Gemini function responses', () => {
    const anthropic = observeToolResults(
      {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_1',
                name: 'lookup_contact',
                input: { name: 'Ali' },
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'toolu_1', content: 'ali@gmail.com' },
            ],
          },
        ],
      },
      'anthropic',
    );
    expect(anthropic[0]?.toolName).toBe('lookup_contact');
    expect(anthropic[0]?.outputText).toBe('ali@gmail.com');

    const gemini = observeToolResults(
      {
        contents: [
          {
            parts: [
              { functionCall: { name: 'lookup_contact', args: { name: 'Ali' } } },
              {
                functionResponse: {
                  name: 'lookup_contact',
                  response: { email: 'ali@gmail.com' },
                },
              },
            ],
          },
        ],
      },
      'gemini',
    );
    expect(gemini[0]?.toolName).toBe('lookup_contact');
    expect(gemini[0]?.outputText).toContain('ali@gmail.com');
  });

  it('keeps an unpaired tool result so its text still counts as content', () => {
    const observed = observeToolResults(
      {
        messages: [
          { role: 'tool', tool_call_id: 'missing', content: 'ahmad@gmail.com' },
        ],
      },
      'openai',
    );

    expect(observed[0]?.toolName).toBe('unknown');
    expect(observed[0]?.outputText).toBe('ahmad@gmail.com');
  });
});
