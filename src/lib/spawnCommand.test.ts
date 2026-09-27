import { describe, expect, it } from 'vitest';
import { prepareUserCommand, quoteCmdToken } from './spawnCommand';

describe('quoteCmdToken', () => {
  it('leaves plain tokens alone and quotes paths and spaces', () => {
    expect(quoteCmdToken('npx')).toBe('npx');
    expect(quoteCmdToken('')).toBe('""');
    expect(quoteCmdToken('examples/agent.py')).toBe('"examples/agent.py"');
    expect(quoteCmdToken('Summarize document doc-1')).toBe(
      '"Summarize document doc-1"',
    );
    expect(quoteCmdToken('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes only on Windows', () => {
    const command = ['examples/agent.py', 'Summarize document doc-1'];
    expect(prepareUserCommand(command, 'linux')).toEqual({
      file: 'examples/agent.py',
      args: ['Summarize document doc-1'],
      shell: false,
      windowsVerbatimArguments: false,
    });
    expect(prepareUserCommand(command, 'win32')).toEqual({
      file: '"examples/agent.py"',
      args: ['"Summarize document doc-1"'],
      shell: true,
      windowsVerbatimArguments: true,
    });
  });
});
