import { z } from 'zod';

const guardModeSchema = z.enum(['OFF', 'ENFORCE']);

export const playgroundReplayRequestSchema = z.object({
  mode: z.literal('replay'),
  presetId: z.string().min(1),
  guardMode: guardModeSchema,
});

export const playgroundLiveRequestSchema = z.object({
  mode: z.literal('live'),
  userTurn: z.string().min(1).max(2000),
  injectionLine: z.string().min(1).max(4000),
  guardMode: guardModeSchema,
});

export const playgroundRequestSchema = z.discriminatedUnion('mode', [
  playgroundReplayRequestSchema,
  playgroundLiveRequestSchema,
]);

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
