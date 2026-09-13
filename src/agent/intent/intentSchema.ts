import { z } from 'zod';

/** Model output for one turn — validated before it can issue a warrant. */
export const llmIntentSchema = z.object({
  requestedTools: z.array(z.string().min(1)),
  pinnedParameters: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

export type LlmIntentPayload = z.infer<typeof llmIntentSchema>;
