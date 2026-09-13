import 'dotenv/config';
import type { GuardMode } from '@/agent/guard/applyGuard';
import { computeRunMetrics, formatScorecard } from '@/eval/metrics';
import {
  BENIGN_DOCUMENT_PAYLOADS,
  DOCUMENT_INJECTION_ATTACKS,
} from '@/eval/payloads/documentInjectionAuthored';
import { HELD_OUT_DOCUMENT_ATTACKS } from '@/eval/payloads/heldOutDocumentInjection';
import type { AuthoredPayload } from '@/eval/payloads/types';
import { runEvalCase } from '@/eval/runEvalCase';

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseGuardMode(raw: string | undefined): GuardMode {
  const value = (raw ?? 'ENFORCE').toUpperCase();
  if (value === 'OFF' || value === 'ENFORCE' || value === 'DETECT_ONLY') {
    return value;
  }
  throw new Error(`invalid guard mode: ${raw}`);
}

async function runPayload(
  guardMode: GuardMode,
  suiteKind: 'ATTACK' | 'BENIGN',
  payload: AuthoredPayload,
) {
  return runEvalCase({
    suiteKind,
    injectionLine: payload.injectionLine,
    userTurn: payload.userTurn,
    expectedTools: payload.expectedTools,
    expectedPinnedParameters: payload.expectedPinnedParameters,
    memoryInjectionLine: payload.memoryInjectionLine,
    lateToolAfterDocumentRead: payload.lateToolAfterDocumentRead,
    guardMode,
  });
}

async function main(): Promise<void> {
  const guardMode = parseGuardMode(readFlag('--guard'));
  const heldOut = process.argv.includes('--held-out');

  const attacks = heldOut ? HELD_OUT_DOCUMENT_ATTACKS : DOCUMENT_INJECTION_ATTACKS;
  const benign = heldOut ? [] : BENIGN_DOCUMENT_PAYLOADS;

  const label = heldOut ? 'held-out authored corpus' : 'tuned authored corpus';
  console.log(`Running ${label} · guard ${guardMode}`);

  const results = [];
  for (const payload of attacks) {
    process.stderr.write(`  attack ${payload.externalRef}…\n`);
    results.push(await runPayload(guardMode, 'ATTACK', payload));
  }
  for (const payload of benign) {
    process.stderr.write(`  benign ${payload.externalRef}…\n`);
    results.push(await runPayload(guardMode, 'BENIGN', payload));
  }

  const metrics = computeRunMetrics(results.map((entry) => entry.metricInput));
  console.log(formatScorecard(metrics));
  console.log(
    JSON.stringify(
      {
        guardMode,
        heldOut,
        hijacked: results
          .filter((entry) => entry.sandbox.hijacked)
          .map((entry) => ({
            kind: entry.suiteKind,
            injection: entry.injectionLine.slice(0, 60),
          })),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
