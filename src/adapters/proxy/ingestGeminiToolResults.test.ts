import { describe, expect, it } from 'vitest';
import { TurnSecretTracker } from '@/core/output/turnSecrets';
import { buildProxyRegistry } from './classifyDiscoveredTool';
import { appendGeminiToolSecretsToTracker } from './ingestGeminiToolResults';

const registry = buildProxyRegistry([
  { name: 'get_api_key', description: 'Returns a key', parameterNames: [] },
  { name: 'read_document', description: 'Read a document', parameterNames: ['id'] },
]);

describe('appendGeminiToolSecretsToTracker', () => {
  it('redacts a secret returned as a Gemini functionResponse', () => {
    const tracker = new TurnSecretTracker();
    appendGeminiToolSecretsToTracker(
      tracker,
      {
        contents: [
          {
            parts: [
              {
                functionResponse: {
                  name: 'get_api_key',
                  response: { value: 'sk_live_ABC123456' },
                },
              },
            ],
          },
        ],
      },
      registry,
    );

    expect(tracker.redactUnauthorizedInText('key sk_live_ABC123456', []).text).toBe(
      'key [REDACTED]',
    );
  });

  it('leaves a document result alone', () => {
    const tracker = new TurnSecretTracker();
    appendGeminiToolSecretsToTracker(
      tracker,
      {
        contents: [
          {
            parts: [
              {
                functionResponse: {
                  name: 'read_document',
                  response: { text: 'Revenue grew 12 percent' },
                },
              },
            ],
          },
        ],
      },
      registry,
    );

    expect(
      tracker.redactUnauthorizedInText('Revenue grew 12 percent', []).redacted,
    ).toBe(false);
  });
});
