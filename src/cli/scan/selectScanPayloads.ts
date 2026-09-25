import type { AuthoredPayload } from '@/eval/payloads/types';

/**
 * A scan runs the target agent twice per payload, so the full corpus is too slow
 * for an interactive check. Breadth beats depth here: take one payload from each
 * attack category first, then backfill, so a short scan still covers distinct
 * hijack techniques rather than N variations of the first one.
 */
export function selectScanPayloads(
  payloads: readonly AuthoredPayload[],
  limit: number,
): readonly AuthoredPayload[] {
  if (limit >= payloads.length) {
    return payloads;
  }

  const selected: AuthoredPayload[] = [];
  const seenCategories = new Set<string>();

  for (const payload of payloads) {
    if (selected.length >= limit) {
      break;
    }
    if (seenCategories.has(payload.category)) {
      continue;
    }
    seenCategories.add(payload.category);
    selected.push(payload);
  }

  for (const payload of payloads) {
    if (selected.length >= limit) {
      break;
    }
    if (!selected.includes(payload)) {
      selected.push(payload);
    }
  }

  return Object.freeze(selected);
}
