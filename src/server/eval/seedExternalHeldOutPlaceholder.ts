import type { PrismaClient } from '@prisma/client';

export const EXTERNAL_HELD_OUT_SUITE_SLUG = 'external-corpus-held-out';

/**
 * Reserved suite for third-party corpora (promptfoo, garak, AgentDojo imports).
 * Payloads are added by import scripts — never used to tune guard logic.
 */
export async function seedExternalHeldOutPlaceholder(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.suite.upsert({
    where: { slug: EXTERNAL_HELD_OUT_SUITE_SLUG },
    create: {
      slug: EXTERNAL_HELD_OUT_SUITE_SLUG,
      name: 'External corpora (held out)',
      kind: 'ATTACK',
      surface: 'DOCUMENT',
      source: 'PROMPTFOO',
      isHeldOut: true,
      description:
        'Placeholder for imported third-party attack suites. See docs/HELD_OUT.md.',
    },
    update: {
      name: 'External corpora (held out)',
      isHeldOut: true,
      source: 'PROMPTFOO',
      description:
        'Placeholder for imported third-party attack suites. See docs/HELD_OUT.md.',
    },
  });
}
