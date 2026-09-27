import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProxyPolicy } from './proxyPolicy';
import { loadToolPin, resolveToolPin, saveToolPin, toolPinPath } from './toolPin';

const policyWithoutPins: ProxyPolicy = {
  intentMode: 'heuristic',
  approvalMode: 'prompt',
  streaming: 'guard',
  destructiveRequiresExplicitUser: true,
};

describe('tool pin file', () => {
  it('round-trips the tool list and prefers it over the policy seed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'warrant-pin-'));
    try {
      saveToolPin(root, [
        { name: 'read_document', parameterNames: ['id'] },
        { name: 'send_email', parameterNames: ['body', 'to'] },
      ]);

      expect(loadToolPin(root)).toEqual([
        { name: 'read_document', parameterNames: ['id'] },
        { name: 'send_email', parameterNames: ['body', 'to'] },
      ]);
      expect(
        resolveToolPin(root, {
          ...policyWithoutPins,
          pinnedTools: [{ name: 'other', parameterNames: [] }],
        }),
      ).toEqual([
        { name: 'read_document', parameterNames: ['id'] },
        { name: 'send_email', parameterNames: ['body', 'to'] },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses the policy list only when nothing has been saved', () => {
    expect(
      resolveToolPin('/no/such/pin/dir', {
        ...policyWithoutPins,
        pinnedTools: [{ name: 'read_document', parameterNames: ['id'] }],
      }),
    ).toEqual([{ name: 'read_document', parameterNames: ['id'] }]);
  });

  it('ignores a pin file that is not valid JSON', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'warrant-pin-'));
    try {
      await mkdir(path.join(root, '.warrant'), { recursive: true });
      await writeFile(toolPinPath(root), '{', 'utf8');
      expect(loadToolPin(root)).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
