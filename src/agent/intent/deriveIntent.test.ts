import { describe, expect, it } from 'vitest';
import { deriveIntentFromUserTurn } from './deriveIntent';

describe('deriveIntentFromUserTurn', () => {
  it('authorizes read_document for the default demo request', () => {
    const intent = deriveIntentFromUserTurn(
      'Please summarize document doc-1 for me in 2 sentences.',
    );
    expect(intent.requestedTools).toEqual(['read_document']);
    expect(intent.pinnedParameters?.['read_document']).toEqual({ id: 'doc-1' });
  });

  it('authorizes send_email when the user explicitly asks to email', () => {
    const intent = deriveIntentFromUserTurn(
      'Send an email to alice@example.com with the summary.',
    );
    expect(intent.requestedTools).toContain('send_email');
    expect(intent.pinnedParameters?.['send_email']).toEqual({
      to: 'alice@example.com',
    });
  });

  it('authorizes get_api_key only when the user asked for the key', () => {
    const intent = deriveIntentFromUserTurn('What is our API key for the sandbox?');
    expect(intent.requestedTools).toEqual(['get_api_key']);
  });
});
