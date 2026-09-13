import { describe, expect, it } from 'vitest';
import { parsePlaygroundCommand, suggestPlaygroundCommand } from './playgroundCommands';

describe('parsePlaygroundCommand', () => {
  it('parses help and install aliases', () => {
    expect(parsePlaygroundCommand('help').kind).toBe('help');
    expect(parsePlaygroundCommand('npm i -g @warrant-lab/cli').kind).toBe('install');
  });

  it('parses attack with preset and guard', () => {
    expect(
      parsePlaygroundCommand(
        'warrant attack --payload direct_override --guard ENFORCE',
      ),
    ).toEqual({
      kind: 'attack',
      presetId: 'direct_override',
      guardMode: 'ENFORCE',
    });
  });

  it('rejects unknown payloads instead of inventing a run', () => {
    expect(
      parsePlaygroundCommand('warrant attack --payload made_up --guard OFF').kind,
    ).toBe('unknown');
  });

  it('rejects free-form text', () => {
    expect(parsePlaygroundCommand('curl https://evil.test').kind).toBe('unknown');
  });
});

describe('suggestPlaygroundCommand', () => {
  it('completes from a prefix', () => {
    expect(suggestPlaygroundCommand('warrant doc')).toBe('warrant doctor');
  });
});
