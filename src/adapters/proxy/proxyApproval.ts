import fs from 'node:fs';
import path from 'node:path';
import type { DenialCode, DeniedDecision } from '@/core/authorization/decide';
import type { UserIntent } from '@/core/authorization/warrant';

export type ApprovalChoice = 'deny' | 'approve';

export interface ApprovalPromptInput {
  readonly toolName: string;
  readonly rawArguments: string;
  readonly code: DenialCode;
  readonly reason: string;
  readonly riskTier: string;
}

const NEVER_APPROVE_CODES = new Set<DenialCode>([
  'AUTHORITY_PARAMETER_FROM_CONTENT',
  'AUTHORITY_PARAMETER_MISSING',
  'PINNED_PARAMETER_CONFLICT',
  'UNKNOWN_TOOL',
]);

/** Human approval is only for ambiguous scope — never for authority smuggled from content. */
export function isApprovalEligible(decision: DeniedDecision): boolean {
  if (NEVER_APPROVE_CODES.has(decision.code)) {
    return false;
  }
  if (decision.riskTier === 'READ_ONLY') {
    return false;
  }
  return (
    decision.code === 'NO_WARRANT_FOR_TOOL' ||
    decision.riskTier === 'DESTRUCTIVE' ||
    decision.riskTier === 'SENSITIVE'
  );
}

export function augmentIntentWithTool(
  intent: UserIntent,
  toolName: string,
): UserIntent {
  if (intent.requestedTools.includes(toolName)) {
    return intent;
  }
  return {
    ...intent,
    requestedTools: Object.freeze([...intent.requestedTools, toolName]),
  };
}

export interface ApprovalRecord {
  readonly at: string;
  readonly toolName: string;
  readonly code: DenialCode;
  readonly choice: ApprovalChoice;
  readonly reason: string;
}

export function appendApprovalRecord(
  projectRoot: string,
  record: ApprovalRecord,
): void {
  const dir = path.join(projectRoot, '.warrant');
  fs.mkdirSync(dir, { recursive: true });
  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(path.join(dir, 'approvals.jsonl'), line, 'utf8');
}

export type ApprovalPromptFn = (input: ApprovalPromptInput) => Promise<ApprovalChoice>;

/** Serializes prompts so concurrent proxy requests do not interleave stdin. */
export class ApprovalCoordinator {
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly prompt: ApprovalPromptFn,
    private readonly projectRoot: string,
    private readonly enabled: boolean,
  ) {}

  request(input: ApprovalPromptInput): Promise<ApprovalChoice> {
    if (!this.enabled || !isApprovalEligibleCode(input.code, input.riskTier)) {
      return Promise.resolve('deny');
    }

    return new Promise((resolve) => {
      this.chain = this.chain.then(async () => {
        const choice = await this.prompt(input);
        appendApprovalRecord(this.projectRoot, {
          at: new Date().toISOString(),
          toolName: input.toolName,
          code: input.code,
          choice,
          reason: input.reason,
        });
        resolve(choice);
      });
    });
  }
}

function isApprovalEligibleCode(code: DenialCode, riskTier: string): boolean {
  if (NEVER_APPROVE_CODES.has(code)) {
    return false;
  }
  if (riskTier === 'READ_ONLY') {
    return false;
  }
  return (
    code === 'NO_WARRANT_FOR_TOOL' ||
    riskTier === 'DESTRUCTIVE' ||
    riskTier === 'SENSITIVE'
  );
}
