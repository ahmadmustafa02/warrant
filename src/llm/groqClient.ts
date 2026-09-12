import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';
import type { ChatMessage, LlmUsage, ToolDefinitionForApi } from './types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

let cachedClient: OpenAI | undefined;

export function getGroqClient(): OpenAI {
  const { GROQ_API_KEY } = serverEnv();
  cachedClient ??= new OpenAI({ apiKey: GROQ_API_KEY, baseURL: GROQ_BASE_URL });
  return cachedClient;
}

export type GroqChatWithToolsResult = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  usage: LlmUsage;
  finishReason: string | null;
};

export async function groqChatWithTools(options: {
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinitionForApi[];
  temperature?: number;
}): Promise<GroqChatWithToolsResult> {
  const client = getGroqClient();
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
