import OpenAI from 'openai';
import type { ChatMessage, LlmUsage, ToolDefinitionForApi } from './types';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

export function openAiCompatibleBaseUrl(): string {
  const fromEnv = process.env.OPENAI_BASE_URL?.trim();
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

export function openAiCompatibleApiKey(): string {
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq !== undefined && groq !== '') {
    return groq;
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
  return new OpenAI({ apiKey, baseURL: openAiCompatibleBaseUrl() });
}

export type ChatWithToolsResult = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  usage: LlmUsage;
  finishReason: string | null;
};

export async function chatWithTools(options: {
  client?: OpenAI;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinitionForApi[];
  temperature?: number;
}): Promise<ChatWithToolsResult> {
  const client = options.client ?? createOpenAiCompatibleClient();
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
