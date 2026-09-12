import type { AttackSurface, PrismaClient } from '@prisma/client';
import { HELD_OUT_DOCUMENT_ATTACKS } from '@/eval/payloads/heldOutDocumentInjection';
import type { AuthoredPayload } from '@/eval/payloads/types';
import { applyRecipientVariant } from '@/eval/payloads/injectionRecipientVariant';

export const HELD_OUT_ATTACK_SUITE_SLUG = 'document-injection-held-out';

function surfaceForPayload(payload: AuthoredPayload): AttackSurface {
  if (payload.memoryInjectionLine !== undefined) {
    return 'MEMORY';
  }
  if (payload.expectedTools.includes('delegate_worker')) {
    return 'MULTI_AGENT';
  }
  return 'DOCUMENT';
}

async function upsertHeldOutSuite(prisma: PrismaClient) {
  return prisma.suite.upsert({
    where: { slug: HELD_OUT_ATTACK_SUITE_SLUG },
    create: {
      slug: HELD_OUT_ATTACK_SUITE_SLUG,
      name: 'Document injection (held out)',
      kind: 'ATTACK',
      surface: 'DOCUMENT',
      source: 'AUTHORED',
      isHeldOut: true,
      description:
        'Reserved attack lines — never used to tune guard rules. Run via pnpm run eval:held-out.',
    },
    update: {
      name: 'Document injection (held out)',
      kind: 'ATTACK',
      isHeldOut: true,
      description:
        'Reserved attack lines — never used to tune guard rules. Run via pnpm run eval:held-out.',
    },
  });
}

export async function seedHeldOutEvalData(prisma: PrismaClient): Promise<void> {
  const suite = await upsertHeldOutSuite(prisma);

  for (const payload of HELD_OUT_DOCUMENT_ATTACKS) {
    const content =
      payload.category === 'memory_poison'
        ? payload.injectionLine
        : applyRecipientVariant(payload.injectionLine, 'realistic');

    await prisma.payload.upsert({
      where: {
        suiteId_externalRef: {
          suiteId: suite.id,
          externalRef: payload.externalRef,
        },
      },
      create: {
        suiteId: suite.id,
        externalRef: payload.externalRef,
        category: payload.category,
        surface: surfaceForPayload(payload),
        severity: payload.severity,
        content,
        userTurn: payload.userTurn ?? null,
        expectedTools: [...payload.expectedTools],
        notes: payload.notes ?? null,
      },
      update: {
        category: payload.category,
        surface: surfaceForPayload(payload),
        severity: payload.severity,
        content,
        userTurn: payload.userTurn ?? null,
        expectedTools: [...payload.expectedTools],
        notes: payload.notes ?? null,
      },
    });
  }
}
