import { describe, expect, it } from 'vitest';
import { deriveCursorIntentFromPrompt } from './deriveCursorIntent';

describe('deriveCursorIntentFromPrompt', () => {
  it('does not grant network shell for ordinary coding prompts', () => {
    const intent = deriveCursorIntentFromPrompt('fix the failing unit test');
    expect(intent.requestedTools).not.toContain('shell_network');
  });

  it('grants shell_network when the user names curl or install', () => {
    const intent = deriveCursorIntentFromPrompt(
      'please curl https://api.example.com/health and summarize',
    );
    expect(intent.requestedTools).toContain('shell_network');
    expect(intent.pinnedParameters?.shell_network?.target).toContain('api.example.com');
  });
});
