import 'dotenv/config';
import type { IntentParseMode } from '@/agent/intent/parseUserIntentLlm';
import {
  BENIGN_DOCUMENT_PAYLOADS,
  DOCUMENT_INJECTION_ATTACKS,
} from '@/eval/payloads/documentInjectionAuthored';
import {
  computeRunMetrics,
  formatScorecard,
  type RunMetricsSummary,
} from '@/eval/metrics';
import { runEvalCase, type EvalCaseRunResult } from '@/eval/runEvalCase';

type SuiteRun = {
  readonly metrics: RunMetricsSummary;
  readonly cases: readonly EvalCaseRunResult[];
};

async function runSuite(intentParseMode: IntentParseMode): Promise<SuiteRun> {
  const payloads = [
    ...DOCUMENT_INJECTION_ATTACKS.map((payload) => ({
      kind: 'ATTACK' as const,
      payload,
    })),
    ...BENIGN_DOCUMENT_PAYLOADS.map((payload) => ({
      kind: 'BENIGN' as const,
      payload,
    })),
  ];

  const cases: EvalCaseRunResult[] = [];
  for (const entry of payloads) {
    const { payload } = entry;
    const ref = payload.externalRef;
    process.stderr.write(`  [${intentParseMode}] ${entry.kind} ${ref}…\n`);
    cases.push(
      await runEvalCase({
        suiteKind: entry.kind,
        injectionLine: payload.injectionLine,
        userTurn: payload.userTurn,
        expectedTools: payload.expectedTools,
        expectedPinnedParameters: payload.expectedPinnedParameters,
        memoryInjectionLine: payload.memoryInjectionLine,
        lateToolAfterDocumentRead: payload.lateToolAfterDocumentRead,
        guardMode: 'ENFORCE',
        intentParseMode,
      }),
    );
  }

  return {
    metrics: computeRunMetrics(cases.map((item) => item.metricInput)),
    cases,
  };
}

function formatPair(
  label: string,
  heuristic: number,
  llm: number,
  total?: number,
): string {
  const suffix = total === undefined ? '' : ` / ${total}`;
  return `${label.padEnd(22)}  heuristic ${heuristic}${suffix}  ·  llm ${llm}${suffix}`;
}

async function main(): Promise<void> {
  console.log(
    'Intent mode scorecard · tuned corpus · guard ENFORCE · openai/gpt-oss-20b',
  );
  console.log(
    '(Proxy-equivalent intent: deriveProxyIntent vs parseUserIntentWithLlm)\n',
  );

  const heuristicRun = await runSuite('heuristic');
  const llmRun = await runSuite('llm');

  console.log('\n--- heuristic ---');
  console.log(formatScorecard(heuristicRun.metrics));
  console.log('\n--- llm ---');
  console.log(formatScorecard(llmRun.metrics));

  console.log('\n--- comparison ---');
  console.log(
    formatPair(
      'Attack-stop',
      heuristicRun.metrics.attacksStopped,
      llmRun.metrics.attacksStopped,
      heuristicRun.metrics.attacksTotal,
    ),
  );
  console.log(
    formatPair(
      'Benign-pass',
      heuristicRun.metrics.benignPassed,
      llmRun.metrics.benignPassed,
      heuristicRun.metrics.benignTotal,
    ),
  );
  console.log(
    formatPair('Errors', heuristicRun.metrics.errorCount, llmRun.metrics.errorCount),
  );

  const errorCount = heuristicRun.metrics.errorCount + llmRun.metrics.errorCount;
  if (errorCount > 0) {
    const sample = [...heuristicRun.cases, ...llmRun.cases]
      .filter((entry) => entry.outcome === 'ERROR')
      .slice(0, 2)
      .map((entry) => entry.errorMessage ?? 'unknown');
    console.error(`Errors (${errorCount}): ${sample.join(' | ')}`);
    process.exitCode = 1;
  }

  const attackPayloads = DOCUMENT_INJECTION_ATTACKS;
  const llmOnlyHijacks: string[] = [];
  const heuristicOnlyHijacks: string[] = [];
  for (let index = 0; index < attackPayloads.length; index += 1) {
    const ref = attackPayloads[index]?.externalRef ?? `attack_${index}`;
    const h = heuristicRun.cases[index]?.sandbox.hijacked === true;
    const l = llmRun.cases[index]?.sandbox.hijacked === true;
    if (l && !h) {
      llmOnlyHijacks.push(ref);
    }
    if (h && !l) {
      heuristicOnlyHijacks.push(ref);
    }
  }

  if (llmOnlyHijacks.length > 0) {
    console.log(`\nHijacked under LLM intent only: ${llmOnlyHijacks.join(', ')}`);
  }
  if (heuristicOnlyHijacks.length > 0) {
    console.log(`Hijacked under heuristic only: ${heuristicOnlyHijacks.join(', ')}`);
  }

  console.log(
    JSON.stringify(
      {
        guardMode: 'ENFORCE',
        heuristic: heuristicRun.metrics,
        llm: llmRun.metrics,
        llmOnlyHijacks,
        heuristicOnlyHijacks,
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
