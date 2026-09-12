import { z } from 'zod';

export const hookEventNames = [
  'beforeSubmitPrompt',
  'beforeShellExecution',
  'beforeMCPExecution',
  'postToolUse',
  'preToolUse',
] as const;

export type HookEventName = (typeof hookEventNames)[number];

const baseFields = {
  conversation_id: z.string().optional(),
  session_id: z.string().optional(),
};

export const beforeSubmitPromptSchema = z
  .object({
    ...baseFields,
    prompt: z.string().optional(),
    user_message: z.string().optional(),
  })
  .passthrough();

export const beforeShellExecutionSchema = z
  .object({
    ...baseFields,
    command: z.string(),
  })
  .passthrough();

export const beforeMcpExecutionSchema = z
  .object({
    ...baseFields,
    tool: z.string().optional(),
    tool_name: z.string().optional(),
    server: z.string().optional(),
    arguments: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const postToolUseSchema = z
  .object({
    ...baseFields,
    tool: z.string().optional(),
    tool_name: z.string().optional(),
    file_path: z.string().optional(),
    path: z.string().optional(),
  })
  .passthrough();

export const preToolUseSchema = z
  .object({
    ...baseFields,
    tool: z.string().optional(),
    tool_name: z.string().optional(),
    file_path: z.string().optional(),
    path: z.string().optional(),
  })
  .passthrough();

export function sessionIdFromPayload(payload: {
  conversation_id?: string;
  session_id?: string;
}): string {
  return payload.conversation_id ?? payload.session_id ?? 'default';
}
