import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

/**
 * cmd.exe reads `/` inside an unquoted token as a switch, so `examples/app/agent.py`
 * is launched as the command `examples`. Quote any token that would be split or
 * reparsed. Quotes inside a token are escaped the cmd way, by doubling them.
 */
export function quoteCmdToken(token: string): string {
  if (token.length === 0) {
    return '""';
  }
  if (!/[\s"/]/.test(token)) {
    return token;
  }
  return `"${token.replaceAll('"', '""')}"`;
}

export function prepareUserCommand(
  command: readonly string[],
  platform: NodeJS.Platform = process.platform,
): {
  readonly file: string;
  readonly args: readonly string[];
  readonly shell: boolean;
  readonly windowsVerbatimArguments: boolean;
} {
  const file = command[0] ?? '';
  const args = command.slice(1);
  if (platform !== 'win32') {
    return { file, args, shell: false, windowsVerbatimArguments: false };
  }
  return {
    file: quoteCmdToken(file),
    args: args.map(quoteCmdToken),
    shell: true,
    windowsVerbatimArguments: true,
  };
}

/** Spawns a user-supplied agent command. On Windows the shell is cmd.exe. */
export function spawnUserCommand(
  command: readonly string[],
  options: SpawnOptions,
): ChildProcess {
  const prepared = prepareUserCommand(command);
  return spawn(prepared.file, [...prepared.args], {
    ...options,
    shell: prepared.shell,
    windowsVerbatimArguments: prepared.windowsVerbatimArguments,
  });
}
