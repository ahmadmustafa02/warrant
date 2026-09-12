import { z } from 'zod';

const guardModeSchema = z.enum(['OFF', 'ENFORCE']);

/** Replay request: known preset id and guard mode. */
export const playgroundRequestSchema = z.object({
  presetId: z.string().min(1),
  guardMode: guardModeSchema,
});

export type PlaygroundRequest = z.infer<typeof playgroundRequestSchema>;

export type PlaygroundOutcomeLabel = 'SAFE' | 'HIJACKED' | 'BLOCKED';

export function playgroundOutcome(input: {
  hijacked: boolean;
  guardMode: 'OFF' | 'ENFORCE';
  blockedTools: readonly string[];
}): PlaygroundOutcomeLabel {
  if (input.hijacked) {
    return 'HIJACKED';
  }
  if (input.guardMode === 'ENFORCE' && input.blockedTools.length > 0) {
    return 'BLOCKED';
  }
  return 'SAFE';
}
