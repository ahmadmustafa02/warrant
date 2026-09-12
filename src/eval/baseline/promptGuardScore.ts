import { z } from 'zod';

/** Matches the spike and README comparison against llama-prompt-guard-2. */
export const DEFAULT_PROMPT_GUARD_THRESHOLD = 0.5;

const scoreSchema = z.number().min(0).max(1);

export function parsePromptGuardScore(raw: string): number {
  const parsed = scoreSchema.safeParse(Number.parseFloat(raw.trim()));
  if (!parsed.success) {
    throw new Error(`Prompt Guard returned a non-numeric score: ${raw}`);
  }
  return parsed.data;
}

export function isPromptGuardFlagged(score: number, threshold: number): boolean {
  return score >= threshold;
}
