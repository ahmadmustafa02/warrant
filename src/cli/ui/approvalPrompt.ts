import * as p from '@clack/prompts';
import pc from 'picocolors';
import type {
  ApprovalChoice,
  ApprovalPromptInput,
} from '@/adapters/proxy/proxyApproval';
import { warrantRule } from './brand';

function formatArgs(raw: string): string {
  if (raw.length <= 240) {
    return raw;
  }
  return `${raw.slice(0, 237)}…`;
}

export async function clackApprovalPrompt(
  input: ApprovalPromptInput,
): Promise<ApprovalChoice> {
  p.log.message(`${warrantRule()}`);
  p.log.info(
    [
      pc.bold('Approval required'),
      `${pc.dim('Tool')}     ${pc.white(input.toolName)}`,
      `${pc.dim('Risk')}     ${pc.yellow(input.riskTier)}`,
      `${pc.dim('Code')}     ${input.code}`,
      `${pc.dim('Reason')}   ${input.reason}`,
      `${pc.dim('Args')}     ${pc.dim(formatArgs(input.rawArguments))}`,
    ].join('\n'),
  );

  const choice = await p.select({
    message: 'Allow this tool call for the current turn?',
    options: [
      {
        value: 'deny' as const,
        label: 'Deny — keep block in place',
        hint: 'recommended when the user did not ask for this',
      },
      {
        value: 'approve' as const,
        label: 'Approve once — add tool to this turn’s warrant',
        hint: 'you are explicitly authorizing this action',
      },
    ],
  });

  if (p.isCancel(choice)) {
    return 'deny';
  }
  return choice;
}

export function nonInteractiveApprovalPrompt(): (
  _input: ApprovalPromptInput,
) => Promise<ApprovalChoice> {
  return () => Promise.resolve('deny');
}
