import fs from 'node:fs';
import { hookEventNames, type HookEventName } from '@/adapters/cursor/hookEvents';
import { runCursorHook } from '@/adapters/cursor/runHook';

function readStdin(): string {
  return fs.readFileSync(0, 'utf8');
}

function parseEvent(raw: string | undefined): HookEventName {
  if (raw === undefined || !hookEventNames.includes(raw as HookEventName)) {
    throw new Error(
      `usage: warrant-cursor-hook <${hookEventNames.join('|')}>  (JSON on stdin)`,
    );
  }
  return raw as HookEventName;
}

function main(): void {
  const event = parseEvent(process.argv[2]);
  const text = readStdin();
  const input: unknown = text.trim() === '' ? {} : JSON.parse(text);
  const result = runCursorHook(event, input, process.cwd());

  const output: Record<string, string> = { permission: result.permission };
  if (result.user_message !== undefined) {
    output.user_message = result.user_message;
  }
  if (result.agent_message !== undefined) {
    output.agent_message = result.agent_message;
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);

  if (result.permission === 'deny') {
    process.exitCode = 2;
  }
}

main();
