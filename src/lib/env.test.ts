import { afterEach, describe, expect, it, vi } from 'vitest';
import { databaseUrl, EnvValidationError, parseServerEnv, serverEnv } from './env';

const minimal = {
  DATABASE_URL: 'postgresql://warrant:pw@localhost:5433/warrant?schema=public',
  GROQ_API_KEY: 'gsk_test_key',
};

describe('parseServerEnv', () => {
  it('accepts the minimal required configuration', () => {
    const env = parseServerEnv(minimal);
    expect(env.DATABASE_URL).toBe(minimal.DATABASE_URL);
    expect(env.GROQ_API_KEY).toBe('gsk_test_key');
  });

  it('applies model defaults so a fresh checkout runs without extra setup', () => {
    const env = parseServerEnv(minimal);
    expect(env.GROQ_TARGET_MODEL).toBe('openai/gpt-oss-20b');
    expect(env.GROQ_BASELINE_GUARD_MODEL).toBe('meta-llama/llama-prompt-guard-2-86m');
    expect(env.SANDBOX_CANARY_SECRET).toBe('WARRANT-CANARY-DO-NOT-USE');
  });

  it('treats empty strings as absent rather than as valid values', () => {
    const env = parseServerEnv({ ...minimal, OPENAI_API_KEY: '' });
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('fails loudly when a required variable is missing', () => {
    expect(() => parseServerEnv({ GROQ_API_KEY: 'gsk_test_key' })).toThrow(
      EnvValidationError,
    );
  });

  it('reports every problem at once instead of one per restart', () => {
    try {
      parseServerEnv({});
      expect.unreachable('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toHaveLength(2);
    }
  });

  it('rejects a canary secret too short to be distinctive in output', () => {
    expect(() =>
      parseServerEnv({ ...minimal, SANDBOX_CANARY_SECRET: 'short' }),
    ).toThrow(EnvValidationError);
  });
});

describe('databaseUrl', () => {
  it('reads the database URL without requiring a model key', () => {
    expect(databaseUrl({ DATABASE_URL: minimal.DATABASE_URL })).toBe(
      minimal.DATABASE_URL,
    );
  });
});

describe('serverEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the process environment and caches the validated result', () => {
    vi.stubEnv('DATABASE_URL', minimal.DATABASE_URL);
    vi.stubEnv('GROQ_API_KEY', minimal.GROQ_API_KEY);

    const first = serverEnv();
    expect(first.GROQ_API_KEY).toBe(minimal.GROQ_API_KEY);
    // Identity, not equality: validation must not re-run on every access.
    expect(serverEnv()).toBe(first);
  });
});
