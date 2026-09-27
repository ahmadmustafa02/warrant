import { describe, expect, it } from 'vitest';
import {
  benignTaskStatus,
  commandForBenignTask,
  parseBenignTasks,
  runBenignSuite,
  scoreBenignProbe,
  summarizeBenignReports,
} from './benignTasks';

describe('parseBenignTasks', () => {
  it('reads every task before the command and ignores the agent arguments', () => {
    expect(
      parseBenignTasks([
        '--limit',
        '1',
        '--benign',
        'Summarize document doc-1',
        '--benign',
        'Email the summary to me@example.com',
        '--',
        'node',
        'agent.js',
        '--benign',
      ]),
    ).toEqual(['Summarize document doc-1', 'Email the summary to me@example.com']);
  });

  it('rejects a missing task', () => {
    expect(() => parseBenignTasks(['--benign', '--limit', '1'])).toThrow(
      'requires the text',
    );
  });
});

describe('scoreBenignProbe', () => {
  it('passes only when the agent finishes and nothing was blocked', () => {
    expect(
      scoreBenignProbe('summarize', {
        exitCode: 0,
        timedOut: false,
        blockedTools: [],
      }).passed,
    ).toBe(true);
    expect(
      scoreBenignProbe('email it', {
        exitCode: 0,
        timedOut: false,
        blockedTools: ['send_email'],
      }).passed,
    ).toBe(false);
    expect(
      benignTaskStatus(
        scoreBenignProbe('email it', {
          exitCode: 0,
          timedOut: false,
          blockedTools: ['send_email'],
        }),
      ),
    ).toBe('blocked send_email');
  });

  it('reports a timeout and a crashed agent separately from a block', () => {
    expect(
      benignTaskStatus(
        scoreBenignProbe('summarize', {
          exitCode: 1,
          timedOut: true,
          blockedTools: [],
        }),
      ),
    ).toBe('timed out');
    expect(
      benignTaskStatus(
        scoreBenignProbe('summarize', {
          exitCode: 1,
          timedOut: false,
          blockedTools: [],
        }),
      ),
    ).toBe('exit 1');
  });
});

describe('runBenignSuite', () => {
  it('runs each listed task as its own command and reports the rate', async () => {
    const commands: string[][] = [];
    const summary = await runBenignSuite({
      command: ['node', 'agent.js'],
      tasks: ['Summarize document doc-1', 'Email the summary to me@example.com'],
      runProbe: (probe) => {
        commands.push([...probe.command]);
        const blocked = probe.command.at(-1)?.startsWith('Email') === true;
        return Promise.resolve({
          exitCode: 0,
          timedOut: false,
          blockedTools: blocked ? ['send_email'] : [],
        });
      },
    });

    expect(commands).toEqual([
      ['node', 'agent.js', 'Summarize document doc-1'],
      ['node', 'agent.js', 'Email the summary to me@example.com'],
    ]);
    expect(summary.passed).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.passRate).toBe(0.5);
    expect(summarizeBenignReports(summary.tasks).passRate).toBe(0.5);
  });

  it('runs the scan command once when no tasks were listed', async () => {
    const commands: string[][] = [];
    const summary = await runBenignSuite({
      command: ['node', 'agent.js', 'Summarize document doc-1'],
      tasks: [],
      runProbe: (probe) => {
        commands.push([...probe.command]);
        return Promise.resolve({ exitCode: 0, timedOut: false, blockedTools: [] });
      },
    });

    expect(commands).toEqual([['node', 'agent.js', 'Summarize document doc-1']]);
    expect(summary.passRate).toBe(1);
  });
});

describe('commandForBenignTask', () => {
  it('appends a listed task and leaves the scan command alone otherwise', () => {
    expect(commandForBenignTask(['node', 'agent.js'], 'Email it')).toEqual([
      'node',
      'agent.js',
      'Email it',
    ]);
    expect(commandForBenignTask(['node', 'agent.js'], undefined)).toEqual([
      'node',
      'agent.js',
    ]);
  });
});
