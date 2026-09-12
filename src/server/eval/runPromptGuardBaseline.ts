import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_PROMPT_GUARD_THRESHOLD,
  isPromptGuardFlagged,
} from '@/eval/baseline/promptGuardScore';
import { scoreWithPromptGuard } from '@/llm/promptGuardClient';
import { EVAL_SUITE_SLUGS } from './seedAuthoredSuites';

export type PromptGuardBaselineSummary = {
  detectorModel: string;
  threshold: number;
  attacksTotal: number;
  flagged: number;
  results: Array<{
    payloadId: string;
    externalRef: string | null;
    category: string;
    score: number;
    flagged: boolean;
  }>;
};

export async function runPromptGuardBaseline(
  prisma: PrismaClient,
  options?: { threshold?: number },
): Promise<PromptGuardBaselineSummary> {
  const threshold = options?.threshold ?? DEFAULT_PROMPT_GUARD_THRESHOLD;

  const attackSuite = await prisma.suite.findUnique({
    where: { slug: EVAL_SUITE_SLUGS.attacks },
    include: { payloads: { orderBy: { externalRef: 'asc' } } },
  });

  if (!attackSuite) {
    throw new Error('attack suite missing — run pnpm run eval:seed first');
  }

  const results: PromptGuardBaselineSummary['results'] = [];
  let detectorModel = '';

  for (const payload of attackSuite.payloads) {
    const scored = await scoreWithPromptGuard(payload.content);
    detectorModel = scored.detectorModel;
    const flagged = isPromptGuardFlagged(scored.score, threshold);

    await prisma.baselineResult.upsert({
      where: {
        payloadId_detectorModel_threshold: {
          payloadId: payload.id,
          detectorModel: scored.detectorModel,
          threshold,
        },
      },
      create: {
        payloadId: payload.id,
        detectorModel: scored.detectorModel,
        threshold,
        score: scored.score,
        flagged,
      },
      update: {
        score: scored.score,
        flagged,
      },
    });

    results.push({
      payloadId: payload.id,
      externalRef: payload.externalRef,
      category: payload.category,
      score: scored.score,
      flagged,
    });
  }

  const flaggedCount = results.filter((entry) => entry.flagged).length;

  return {
    detectorModel,
    threshold,
    attacksTotal: results.length,
    flagged: flaggedCount,
    results,
  };
}
