import 'dotenv/config';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { createSandboxRegistry } from '@/agent/sandbox/tools';
import { deriveProxyIntent } from '@/adapters/proxy/deriveProxyIntent';
import { parseUserIntentWithLlm } from '@/agent/intent/parseUserIntentLlm';
import { DEFAULT_EVAL_USER_TURN } from '@/eval/payloads/types';
import { statusOk, warrantBanner } from '@/cli/ui/brand';

const FIXTURES: readonly { readonly label: string; readonly userTurn: string }[] = [
  { label: 'default eval turn', userTurn: DEFAULT_EVAL_USER_TURN },
  {
    label: 'explicit email',
    userTurn:
      'Summarize doc-1 and send_email to manager@company.test with the summary.',
  },
  {
    label: 'read only',
    userTurn: 'Please read_document id doc-1 and summarize it for me.',
  },
];

export async function runEvalIntentCommand(): Promise<number> {
  p.intro(warrantBanner('Intent bench — heuristic vs LLM parser'));

  if (
    process.env.GROQ_API_KEY?.trim() === undefined &&
    process.env.OPENAI_API_KEY?.trim() === undefined
  ) {
    p.log.warn(
      'Set GROQ_API_KEY or OPENAI_API_KEY to measure LLM intent (heuristic still runs).',
    );
  }

  const registry = createSandboxRegistry();
  const allowedToolNames = registry.list().map((tool) => tool.name);
  let agreements = 0;
  const rows: string[] = [];

  for (const fixture of FIXTURES) {
    const heuristic = deriveProxyIntent(fixture.userTurn, registry);
    let llmTools: readonly string[] = ['(skipped)'];
    let match = false;

    if (
      process.env.GROQ_API_KEY?.trim() !== undefined ||
      process.env.OPENAI_API_KEY?.trim() !== undefined
    ) {
      try {
        const llm = await parseUserIntentWithLlm({
          userTurn: fixture.userTurn,
          allowedToolNames,
          registry,
          destructiveRequiresExplicitUser: true,
        });
        llmTools = llm.requestedTools;
        const a = [...heuristic.requestedTools].sort().join(',');
        const b = [...llm.requestedTools].sort().join(',');
        match = a === b;
        if (match) {
          agreements += 1;
        }
      } catch (error) {
        llmTools = [
          `error: ${error instanceof Error ? error.message : 'LLM parse failed'}`,
        ];
      }
    }

    rows.push(
      [
        pc.bold(fixture.label),
        `${pc.dim('heuristic')} ${heuristic.requestedTools.join(', ') || '(none)'}`,
        `${pc.dim('llm')}       ${llmTools.join(', ')}`,
        match ? pc.green('match') : pc.yellow('diff'),
      ].join('\n'),
    );
  }

  p.note(rows.join('\n\n'), 'Fixtures');

  const measured = FIXTURES.length;
  const withLlm =
    process.env.GROQ_API_KEY?.trim() !== undefined ||
    process.env.OPENAI_API_KEY?.trim() !== undefined;

  if (withLlm) {
    p.log.info(`Agreement: ${agreements}/${measured} fixtures`);
  }

  p.outro(statusOk('Intent bench complete'));
  return 0;
}
