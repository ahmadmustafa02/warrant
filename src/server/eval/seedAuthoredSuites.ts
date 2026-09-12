import type { PrismaClient, SuiteKind } from '@prisma/client';
import {
  BENIGN_DOCUMENT_PAYLOADS,
  DOCUMENT_INJECTION_ATTACKS,
} from '@/eval/payloads/documentInjectionAuthored';
import type { AuthoredPayload } from '@/eval/payloads/types';
import { applyRecipientVariant } from '@/eval/payloads/injectionRecipientVariant';
import { serverEnv } from '@/lib/env';

const ATTACK_SUITE_SLUG = 'document-injection-attacks';
const BENIGN_SUITE_SLUG = 'benign-document-tasks';
const TARGET_SLUG = 'sandbox-gpt-oss-20b';

async function upsertSuite(
  prisma: PrismaClient,
  options: {
    slug: string;
    name: string;
    kind: SuiteKind;
    description: string;
  },
) {
  return prisma.suite.upsert({
    where: { slug: options.slug },
    create: {
      slug: options.slug,
      name: options.name,
      kind: options.kind,
      surface: 'DOCUMENT',
      source: 'AUTHORED',
      isHeldOut: false,
      description: options.description,
    },
    update: {
      name: options.name,
      kind: options.kind,
      surface: 'DOCUMENT',
      description: options.description,
    },
  });
}

function storedInjectionLine(payload: AuthoredPayload, suiteKind: SuiteKind): string {
  if (suiteKind === 'ATTACK') {
    return applyRecipientVariant(payload.injectionLine, 'realistic');
  }
  return payload.injectionLine;
}

async function upsertPayloads(
  prisma: PrismaClient,
  suiteId: string,
  suiteKind: SuiteKind,
  payloads: readonly AuthoredPayload[],
) {
  for (const payload of payloads) {
    const content = storedInjectionLine(payload, suiteKind);
    await prisma.payload.upsert({
      where: {
        suiteId_externalRef: {
          suiteId,
          externalRef: payload.externalRef,
        },
      },
      create: {
        suiteId,
        externalRef: payload.externalRef,
        category: payload.category,
        surface: 'DOCUMENT',
        severity: payload.severity,
        content,
        userTurn: payload.userTurn ?? null,
        expectedTools: [...payload.expectedTools],
        notes: payload.notes ?? null,
      },
      update: {
        category: payload.category,
        severity: payload.severity,
        content,
        userTurn: payload.userTurn ?? null,
        expectedTools: [...payload.expectedTools],
        notes: payload.notes ?? null,
      },
    });
  }
}

export async function seedAuthoredEvalData(prisma: PrismaClient): Promise<void> {
  const env = serverEnv();

  await prisma.targetAgent.upsert({
    where: { slug: TARGET_SLUG },
    create: {
      slug: TARGET_SLUG,
      name: 'Sandbox naive agent (Groq target)',
      description: 'Internal sandbox with read_document, get_api_key, send_email.',
      modelId: env.GROQ_TARGET_MODEL,
      promptProfile: 'NAIVE',
      isSandboxed: true,
    },
    update: {
      modelId: env.GROQ_TARGET_MODEL,
      promptProfile: 'NAIVE',
      isSandboxed: true,
    },
  });

  const attackSuite = await upsertSuite(prisma, {
    slug: ATTACK_SUITE_SLUG,
    name: 'Document injection (authored)',
    kind: 'ATTACK',
    description: 'Ten authored lines from the pre-proposal spike categories.',
  });

  const benignSuite = await upsertSuite(prisma, {
    slug: BENIGN_SUITE_SLUG,
    name: 'Benign document tasks (authored)',
    kind: 'BENIGN',
    description: 'Legitimate requests that must still pass with the guard enabled.',
  });

  await upsertPayloads(prisma, attackSuite.id, 'ATTACK', DOCUMENT_INJECTION_ATTACKS);
  await upsertPayloads(prisma, benignSuite.id, 'BENIGN', BENIGN_DOCUMENT_PAYLOADS);
}

export const EVAL_SUITE_SLUGS = {
  attacks: ATTACK_SUITE_SLUG,
  benign: BENIGN_SUITE_SLUG,
  target: TARGET_SLUG,
} as const;
