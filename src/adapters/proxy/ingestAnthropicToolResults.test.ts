import { describe, expect, it } from 'vitest';
import { buildProxyRegistry } from './classifyDiscoveredTool';
import { appendAnthropicToolSecretsToTracker } from './ingestAnthropicToolResults';
import { TurnSecretTracker } from '@/core/output/turnSecrets';

describe('appendAnthropicToolSecretsToTracker', () => {
  it('records secrets from prior tool_result blocks', () => {
    const registry = buildProxyRegistry(
      [{ name: 'read_vault_entry', description: '', parameterNames: ['id'] }],
      { read_vault_entry: { returnsSecrets: true } },
    );
    const tracker = new TurnSecretTracker();
    const request = {
      model: 'claude',
      max_tokens: 1024,
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'read_vault_entry',
              input: { id: 'canary' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tu_1',
              content: 'CANARY_SECRET_abc123',
            },
          ],
        },
      ],
    };

    appendAnthropicToolSecretsToTracker(tracker, request, registry);

    const redacted = tracker.redactUnauthorizedInText('leak CANARY_SECRET_abc123', []);
    expect(redacted.text).not.toContain('CANARY_SECRET_abc123');
  });
});
