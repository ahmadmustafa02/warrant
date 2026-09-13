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

  it('authorizes send_email when the user names the tool directly', () => {
    // Regression: \bsend\b never matches inside send_email, so this turn used to
    // yield no grant and the guard blocked an action the user had asked for.
    const intent = deriveIntentFromUserTurn(
      'Please summarize document doc-1 in one sentence, then send_email to teammate@company.test with that summary.',
    );
    expect(intent.requestedTools).toContain('send_email');
    expect(intent.pinnedParameters?.['send_email']).toEqual({
      to: 'teammate@company.test',
    });
  });

  it('authorizes get_api_key only when the user asked for the key', () => {
    const intent = deriveIntentFromUserTurn('What is our API key for the sandbox?');
    expect(intent.requestedTools).toEqual(['get_api_key']);
  });

  it('authorizes delegate_worker when the user names the tool directly', () => {
    const intent = deriveIntentFromUserTurn(
      'Summarize document doc-1, then delegate_worker with task "format the summary".',
    );
    expect(intent.requestedTools).toContain('delegate_worker');
  });

  it('authorizes fetch_url and pins the URL the user stated', () => {
    const intent = deriveIntentFromUserTurn(
      'Summarize doc-1, then fetch_url on https://reports.company.test/weekly.',
    );
    expect(intent.requestedTools).toContain('fetch_url');
    expect(intent.pinnedParameters?.['fetch_url']).toEqual({
      url: 'https://reports.company.test/weekly',
    });
  });
});
