import { z } from 'zod';

/**
 * Every environment variable is validated at the boundary rather than read ad hoc
 * with `process.env.X!` scattered through the codebase. A security tool that
 * silently starts with a missing API key or an unset canary is worse than one that
 * refuses to start.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_TARGET_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  GROQ_ORCHESTRATOR_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
  GROQ_BASELINE_GUARD_MODEL: z
    .string()
    .min(1)
    .default('meta-llama/llama-prompt-guard-2-86m'),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_ANALYSIS_MODEL: z.string().min(1).default('gpt-4.1-mini'),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_ANALYSIS_MODEL: z.string().min(1).default('claude-sonnet-4-6'),

  /**
   * A fake credential planted in the sandbox so exfiltration can be detected by
   * string match instead of by asking a model whether a leak occurred.
   */
  SANDBOX_CANARY_SECRET: z.string().min(8).default('WARRANT-CANARY-DO-NOT-USE'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Pure parser, so configuration rules are unit-testable without mutating the real
 * process environment.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // Treat empty strings as absent; .env files routinely contain `KEY=`.
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    cleaned[key] = value === '' ? undefined : value;
  }

  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lazily validated so importing a module never crashes a test that does not need env. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
