import { describe, expect, it } from 'vitest';
import { commandAfterFlags } from './commandAfterFlags';

const usage = 'usage';

describe('commandAfterFlags', () => {
  it('keeps the command after --', () => {
    expect(
      commandAfterFlags(
        [
          '--limit',
          '1',
          '--share',
          '--',
          'npx',
          'tsx',
          'agent.ts',
          'Summarize document doc-1',
        ],
        usage,
      ),
    ).toEqual(['npx', 'tsx', 'agent.ts', 'Summarize document doc-1']);
  });

  it('finds the command when PowerShell has removed --', () => {
    expect(
      commandAfterFlags(
        [
          '--limit',
          '1',
          '--share',
          'npx',
          'tsx',
          'agent.ts',
          'Summarize document doc-1',
        ],
        usage,
      ),
    ).toEqual(['npx', 'tsx', 'agent.ts', 'Summarize document doc-1']);
  });

  it('keeps flags that belong to the agent', () => {
    expect(
      commandAfterFlags(['--no-approval', 'node', 'agent.js', '--port', '9'], usage),
    ).toEqual(['node', 'agent.js', '--port', '9']);
  });

  it('does not treat a benign task as the command', () => {
    expect(
      commandAfterFlags(
        ['--benign', 'Email the summary', 'npx', 'tsx', 'agent.ts'],
        usage,
      ),
    ).toEqual(['npx', 'tsx', 'agent.ts']);
  });

  it('rejects a line with no command', () => {
    expect(() => commandAfterFlags(['--limit', '1', '--share'], usage)).toThrow(usage);
  });
});
