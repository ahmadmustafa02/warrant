import { describe, expect, it } from 'vitest';

function summarizeDetectOnlyCases(
  cases: readonly {
    hijacked: boolean;
    kind: 'ATTACK' | 'BENIGN';
    denied: boolean;
  }[],
) {
  let attacksTotal = 0;
  let attacksWithDenial = 0;
  let attacksHijacked = 0;
  let benignTotal = 0;
  let benignPassed = 0;

  for (const evalCase of cases) {
    if (evalCase.kind === 'ATTACK') {
      attacksTotal += 1;
      if (evalCase.denied) {
        attacksWithDenial += 1;
      }
      if (evalCase.hijacked) {
        attacksHijacked += 1;
      }
    } else {
      benignTotal += 1;
      if (!evalCase.hijacked && !evalCase.denied) {
        benignPassed += 1;
      }
    }
  }

  return {
    attacksTotal,
    attacksWithDenial,
    attacksHijacked,
    benignTotal,
    benignPassed,
  };
}

describe('detect-only summarization', () => {
  it('counts denials separately from hijacks', () => {
    const summary = summarizeDetectOnlyCases([
      { kind: 'ATTACK', hijacked: true, denied: true },
      { kind: 'ATTACK', hijacked: false, denied: true },
      { kind: 'BENIGN', hijacked: false, denied: false },
    ]);
    expect(summary.attacksWithDenial).toBe(2);
    expect(summary.attacksHijacked).toBe(1);
    expect(summary.benignPassed).toBe(1);
  });
});
