import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';
import { chatWithTools } from './openAiCompatibleClient';
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

function isGroqRateLimited(message: string): boolean {
  return message.includes('429') || /rate limit/i.test(message);
}

async function groqChatWithToolsOnce(options: {
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

/**
 * Sandbox eval chat. Prefers Groq; when the org hits Groq rate/TPD limits and
 * OPENAI_API_KEY is set, falls back once to OPENAI_ANALYSIS_MODEL so scorecards
 * can finish without silently marking cases as ERROR.
 */
export async function groqChatWithTools(options: {
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinitionForApi[];
  temperature?: number;
}): Promise<GroqChatWithToolsResult> {
  try {
    return await groqChatWithToolsOnce(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Groq request failed';
    if (!isGroqRateLimited(message)) {
      throw error;
    }
    const env = serverEnv();
    const openAiKey = env.OPENAI_API_KEY?.trim();
    if (openAiKey === undefined || openAiKey === '') {
      throw error;
    }
    process.stderr.write(
      `[groqClient] Groq rate limited; falling back to ${env.OPENAI_ANALYSIS_MODEL} for this completion.\n`,
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
}
