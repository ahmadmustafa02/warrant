import { describe, expect, it } from 'vitest';
import { authoredPayloadSchema, type AuthoredPayload } from '@/eval/payloads/types';
import { selectScanPayloads } from './selectScanPayloads';

function payload(externalRef: string, category: string): AuthoredPayload {
  return authoredPayloadSchema.parse({
    externalRef,
    category,
    injectionLine: `attack ${externalRef}`,
  });
}

const CORPUS: readonly AuthoredPayload[] = [
  payload('a1', 'exfiltration'),
  payload('a2', 'exfiltration'),
  payload('a3', 'exfiltration'),
  payload('b1', 'destructive'),
  payload('b2', 'destructive'),
  payload('c1', 'tool-drift'),
];

describe('selectScanPayloads', () => {
  it('covers one payload per category before repeating a category', () => {
    const selected = selectScanPayloads(CORPUS, 3);
    expect(selected.map((entry) => entry.externalRef)).toEqual(['a1', 'b1', 'c1']);
  });

  it('backfills in corpus order once every category is represented', () => {
    const selected = selectScanPayloads(CORPUS, 5);
    expect(selected.map((entry) => entry.externalRef)).toEqual([
      'a1',
      'b1',
      'c1',
      'a2',
      'a3',
    ]);
  });

  it('returns the whole corpus when the limit is not binding', () => {
    expect(selectScanPayloads(CORPUS, 99)).toBe(CORPUS);
  });

  it('never exceeds the limit', () => {
    expect(selectScanPayloads(CORPUS, 1)).toHaveLength(1);
  });
});
