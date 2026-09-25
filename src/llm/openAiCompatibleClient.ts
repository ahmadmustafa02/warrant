import OpenAI from 'openai';
import { isGroqKeyRotationError, parseGroqApiKeys } from '@/lib/groqKeys';
import type { ChatMessage, LlmUsage, ToolDefinitionForApi } from './types';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

export function openAiCompatibleBaseUrl(): string {
  const fromEnv = process.env.OPENAI_BASE_URL?.trim();
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

export function groqApiKeysFromEnv(): readonly string[] {
  return parseGroqApiKeys(process.env.GROQ_API_KEY?.trim() ?? '');
}

/** First Groq key when listed comma-separated; otherwise OpenAI. */
export function openAiCompatibleApiKey(): string {
  const groqKeys = groqApiKeysFromEnv();
  if (groqKeys.length > 0) {
    return groqKeys[0] ?? '';
  }
  const openAi = process.env.OPENAI_API_KEY?.trim();
  if (openAi !== undefined && openAi !== '') {
    return openAi;
  }
  return '';
}

export function createOpenAiCompatibleClient(): OpenAI {
  const apiKey = openAiCompatibleApiKey();
  if (apiKey === '') {
    throw new Error('Set GROQ_API_KEY or OPENAI_API_KEY');
  }
  return new OpenAI({
    apiKey,
    baseURL: openAiCompatibleBaseUrl(),
    maxRetries: 0,
  });
}

export type ChatWithToolsResult = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  usage: LlmUsage;
  finishReason: string | null;
};

async function chatWithToolsOnce(
  client: OpenAI,
  options: {
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinitionForApi[];
    temperature?: number;
  },
): Promise<ChatWithToolsResult> {
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: options.model,
      temperature: options.temperature ?? 0.2,
      messages: options.messages,
      tools: options.tools,
      stream: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chat completion failed';
    throw new Error(`OpenAI-compatible chat failed: ${message}`);
  }

  const choice = completion.choices[0];
  if (!choice?.message) {
    throw new Error('upstream returned no assistant message');
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

export async function chatWithTools(options: {
  client?: OpenAI;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinitionForApi[];
  temperature?: number;
}): Promise<ChatWithToolsResult> {
  if (options.client !== undefined) {
    return chatWithToolsOnce(options.client, options);
  }

  const baseUrl = openAiCompatibleBaseUrl();
  const onGroq = baseUrl.includes('groq.com');
  const groqKeys = groqApiKeysFromEnv();

  if (onGroq && groqKeys.length > 1) {
    let lastError: Error | undefined;
    for (let index = 0; index < groqKeys.length; index += 1) {
      const apiKey = groqKeys[index];
      if (apiKey === undefined) {
        continue;
      }
      try {
        const client = new OpenAI({ apiKey, baseURL: baseUrl, maxRetries: 0 });
        return await chatWithToolsOnce(client, options);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('chat completion failed');
        lastError = err;
        if (isGroqKeyRotationError(err.message) && index < groqKeys.length - 1) {
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? new Error('OpenAI-compatible chat failed');
  }

  return chatWithToolsOnce(createOpenAiCompatibleClient(), options);
}
