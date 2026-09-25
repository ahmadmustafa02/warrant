import { parseGroqApiKeys } from '@/lib/groqKeys';

/** Resolves upstream model API base URL for the local Warrant proxy. */
export function upstreamBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.WARRANT_UPSTREAM?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit.replace(/\/$/, '');
  }

  const gemini = geminiApiKey(env);
  if (gemini !== undefined) {
    // Gemini OpenAI-compatible surface (works with OpenAI SDK + Groq-shaped clients).
    return 'https://generativelanguage.googleapis.com/v1beta/openai';
  }

  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  if (anthropic !== undefined && anthropic !== '') {
    return 'https://api.anthropic.com/v1';
  }

  const openAi = env.OPENAI_BASE_URL?.trim();
  if (openAi !== undefined && openAi !== '') {
    return openAi.replace(/\/$/, '');
  }

  return 'https://api.groq.com/openai/v1';
}

/** Native Gemini `generateContent` base (Google SDK default path prefix). */
export function geminiNativeUpstreamBase(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.WARRANT_GEMINI_UPSTREAM?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit.replace(/\/$/, '');
  }
  return 'https://generativelanguage.googleapis.com/v1beta';
}

export function geminiApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const gemini = env.GEMINI_API_KEY?.trim();
  if (gemini !== undefined && gemini !== '') {
    return gemini;
  }
  const google = env.GOOGLE_API_KEY?.trim();
  if (google !== undefined && google !== '') {
    return google;
  }
  return undefined;
}

export function upstreamAuthHeader(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const gemini = geminiApiKey(env);
  if (gemini !== undefined) {
    return { 'x-goog-api-key': gemini };
  }

  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  if (anthropic !== undefined && anthropic !== '') {
    return {
      'x-api-key': anthropic,
      'anthropic-version': env.ANTHROPIC_VERSION?.trim() ?? '2023-06-01',
    };
  }

  const groqKeys = parseGroqApiKeys(env.GROQ_API_KEY?.trim() ?? '');
  const groq = groqKeys[0];
  if (groq !== undefined && groq !== '') {
    return { authorization: `Bearer ${groq}` };
  }

  const openAi = env.OPENAI_API_KEY?.trim();
  if (openAi !== undefined && openAi !== '') {
    return { authorization: `Bearer ${openAi}` };
  }

  return {};
}

/** Proxy bases to inject on child processes (OpenAI-shaped + Anthropic + Gemini native). */
export function proxyEnvForChild(proxyHostBase: string): Record<string, string> {
  const trimmed = proxyHostBase.replace(/\/$/, '');
  const root = trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;

  return {
    OPENAI_BASE_URL: `${root}/v1`,
    OPENAI_API_BASE: `${root}/v1`,
    ANTHROPIC_BASE_URL: `${root}/v1`,
    GEMINI_BASE_URL: `${root}/v1beta`,
    GOOGLE_GENERATIVE_AI_BASE_URL: `${root}/v1beta`,
  };
}
