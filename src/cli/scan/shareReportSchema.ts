import { z } from 'zod';

const rate = z.number().min(0).max(1).nullable();

export const publicScanReportSchema = z.object({
  v: z.literal(1),
  at: z.string().datetime(),
  mode: z.enum(['corpus', 'adaptive', 'full']),
  agent: z.string().min(1).max(500),
  summary: z.object({
    payloads: z.number().int().nonnegative(),
    reachable: z.number().int().nonnegative(),
    exploitable: z.number().int().nonnegative(),
    protectedCount: z.number().int().nonnegative(),
    vulnerable: z.number().int().nonnegative(),
    attackStopRate: rate,
  }),
  byShape: z
    .array(
      z.object({
        shape: z.string().min(1).max(80),
        trials: z.number().int().nonnegative(),
        exploitable: z.number().int().nonnegative(),
        protectedCount: z.number().int().nonnegative(),
        vulnerable: z.number().int().nonnegative(),
        attackStopRate: rate,
      }),
    )
    .max(20),
  benign: z.object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    passRate: z.number().min(0).max(1),
    tasks: z
      .array(
        z.object({
          task: z.string().max(300),
          passed: z.boolean(),
        }),
      )
      .max(20),
  }),
  findings: z
    .array(
      z.object({
        id: z.string().max(120),
        category: z.string().max(80),
        verdict: z.enum([
          'not-reachable',
          'not-exploitable',
          'protected',
          'marker-echoed',
          'vulnerable',
        ]),
        tools: z.array(z.string().max(80)).max(12),
      }),
    )
    .max(80),
});

export type PublicScanReport = z.infer<typeof publicScanReportSchema>;
