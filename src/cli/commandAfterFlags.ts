/**
 * The agent command is everything after `--`.
 *
 * PowerShell's npm shim drops that `--` before Node starts. When it is
 * missing, the command is the first word that is not a Warrant flag.
 */

const FLAGS_WITH_VALUES = new Set([
  '--limit',
  '--rounds',
  '--repeats',
  '--benign',
  '--inject-into',
  '--timeout',
  '--user',
]);

export function commandAfterFlags(argv: readonly string[], usage: string): string[] {
  const dash = argv.indexOf('--');
  if (dash >= 0) {
    const command = argv.slice(dash + 1);
    if (command.length === 0) {
      throw new Error(usage);
    }
    return [...command];
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (token.startsWith('--')) {
      if (FLAGS_WITH_VALUES.has(token)) {
        index += 1;
      }
      continue;
    }
    return [...argv.slice(index)];
  }

  throw new Error(usage);
}
