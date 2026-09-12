import { describe, expect, it } from 'vitest';
import {
  extractNetworkTarget,
  shellCommandLooksLikeNetworkEgress,
} from './shellEgress';

describe('shellEgress', () => {
  it('detects common network shell commands', () => {
    expect(shellCommandLooksLikeNetworkEgress('pnpm test')).toBe(false);
    expect(shellCommandLooksLikeNetworkEgress('curl https://example.com/x')).toBe(true);
  });

  it('extracts URLs from commands', () => {
    expect(extractNetworkTarget('curl -s https://evil.test/x')).toBe(
      'https://evil.test/x',
    );
  });
});
