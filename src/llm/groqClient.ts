import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';
import { isGroqKeyRotationError, parseGroqApiKeys } from '@/lib/groqKeys';
import { chatWithTools } from './openAiCompatibleClient';
import type { ChatMessage, LlmUsage, ToolDefinitionForApi } from './types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const clientByKey = new Map<string, OpenAI>();

/** Index of the last Groq key that succeeded; rotation starts here on the next failure. */
let preferredGroqKeyIndex = 0;

export function groqApiKeys(): readonly string[] {
  return parseGroqApiKeys(serverEnv().GROQ_API_KEY);
}

function clientForGroqKey(apiKey: string): OpenAI {
  const existing = clientByKey.get(apiKey);
  if (existing !== undefined) {
    return existing;
  }
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  clientByKey.set(apiKey, client);
  return client;
}

export function getGroqClient(): OpenAI {
  const keys = groqApiKeys();
  const key = keys[preferredGroqKeyIndex] ?? keys[0];
  if (key === undefined) {
    throw new Error('GROQ_API_KEY is empty after parsing');
  }
  return clientForGroqKey(key);
}

export type GroqChatWithToolsResult = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  usage: LlmUsage;
  finishReason: string | null;
};

function isGroqRateLimited(message: string): boolean {
  return message.includes('429') || /rate limit/i.test(message);
}

async function groqChatWithToolsOnce(
  options: {
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinitionForApi[];
    temperature?: number;
  },
  apiKey: string,
): Promise<GroqChatWithToolsResult> {
  const client = clientForGroqKey(apiKey);
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: options.model,
      temperature: options.temperature ?? 0.2,
      messages: options.messages,
      tools: options.tools,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Groq request failed';
    throw new Error(`Groq chat completion failed: ${message}`);
  }

  const choice = completion.choices[0];
  if (!choice?.message) {
    throw new Error('Groq returned no assistant message');
  }

  const usage = completion.usage;
  return {
    message: choice.message,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
    finishReason: choice.finish_reason,
  };
}

/**
 * Sandbox eval chat. Tries each comma-separated Groq key on auth/rate-limit errors.
 * Only when every Groq key is rate-limited and OPENAI_API_KEY is set, falls back to
 * OPENAI_ANALYSIS_MODEL (small/cheap) for that completion.
 */
export async function groqChatWithTools(options: {
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinitionForApi[];
  temperature?: number;
}): Promise<GroqChatWithToolsResult> {
  const keys = groqApiKeys();
  if (keys.length === 0) {
    throw new Error('GROQ_API_KEY is empty after parsing');
  }

  let lastError: Error | undefined;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (preferredGroqKeyIndex + offset) % keys.length;
    const apiKey = keys[index];
    if (apiKey === undefined) {
      continue;
    }
    try {
      const result = await groqChatWithToolsOnce(options, apiKey);
      preferredGroqKeyIndex = index;
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Groq request failed');
      lastError = err;
      const message = err.message;
      if (isGroqKeyRotationError(message) && offset < keys.length - 1) {
        process.stderr.write(
          `[groqClient] Groq key ${index + 1}/${keys.length} failed; trying next key.\n`,
        );
        continue;
      }
      if (!isGroqRateLimited(message)) {
        throw err;
      }
      break;
    }
  }

  const env = serverEnv();
  const openAiKey = env.OPENAI_API_KEY?.trim();
  if (
    lastError !== undefined &&
    isGroqRateLimited(lastError.message) &&
    openAiKey !== undefined &&
    openAiKey !== ''
  ) {
    process.stderr.write(
      `[groqClient] All Groq keys rate limited; falling back to ${env.OPENAI_ANALYSIS_MODEL} for this completion.\n`,
    );
    const client = new OpenAI({ apiKey: openAiKey });
    return chatWithTools({
      client,
      model: env.OPENAI_ANALYSIS_MODEL,
      messages: options.messages,
      tools: options.tools,
      temperature: options.temperature,
    });
  }

  throw lastError ?? new Error('Groq chat completion failed');
}
