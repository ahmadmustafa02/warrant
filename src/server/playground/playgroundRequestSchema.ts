import { z } from 'zod';

export const playgroundRequestSchema = z.object({
  userTurn: z.string().min(1).max(2000),
  injectionLine: z.string().min(1).max(4000),
  guardMode: z.enum(['OFF', 'ENFORCE']),
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
