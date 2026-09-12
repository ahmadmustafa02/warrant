import { parsePromptGuardScore } from '@/eval/baseline/promptGuardScore';
import { serverEnv } from '@/lib/env';
import { getGroqClient } from './groqClient';
import type { LlmUsage } from './types';

export type PromptGuardScoreResult = {
  score: number;
  usage: LlmUsage;
  detectorModel: string;
};

export async function scoreWithPromptGuard(
  text: string,
): Promise<PromptGuardScoreResult> {
  const detectorModel = serverEnv().GROQ_BASELINE_GUARD_MODEL;
  const client = getGroqClient();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: detectorModel,
      messages: [{ role: 'user', content: text }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Groq request failed';
    throw new Error(`Prompt Guard scoring failed: ${message}`);
  }

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error('Prompt Guard returned no score');
  }

  const usage = completion.usage;
  return {
    score: parsePromptGuardScore(content),
    detectorModel,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  };
}
