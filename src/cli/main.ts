#!/usr/bin/env node
import * as p from '@clack/prompts';
import { runAttackCommand } from '@/cli/commands/attack';
import { runDoctorCommand } from '@/cli/commands/doctor';
import { runEvalIntentCommand } from '@/cli/commands/evalIntent';
import { runGuardCommand } from '@/cli/commands/guard';
import { runInitCommand } from '@/cli/commands/init';
import { warrantBanner } from '@/cli/ui/brand';

const HELP = `${warrantBanner()}

Usage:
  warrant init [--from-sandbox] [--llm-intent]
  warrant guard [--detect-only | --off] [--no-approval] -- <command...>
  warrant doctor
  warrant eval intent
  warrant attack [--payload <id>] [--guard ENFORCE|OFF|DETECT_ONLY]

Environment:
  GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY — upstream model access
  WARRANT_INTENT=llm|heuristic — override policy intent mode
`;

export async function runCli(argv: readonly string[]): Promise<number> {
  const [, , command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  try {
    switch (command) {
      case 'init':
        return await runInitCommand(rest);
      case 'guard':
        return await runGuardCommand(rest);
      case 'doctor':
        return await runDoctorCommand();
      case 'eval':
        if (rest[0] === 'intent') {
          return await runEvalIntentCommand();
        }
        p.log.error('Usage: warrant eval intent');
        return 1;
      case 'attack':
        return await runAttackCommand(rest);
      default:
        p.log.error(`Unknown command: ${command}`);
        process.stdout.write(`${HELP}\n`);
        return 1;
    }
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : 'Command failed');
    return 1;
  }
}
