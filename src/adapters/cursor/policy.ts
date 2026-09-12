import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const cursorPolicySchema = z.object({
  protectedPathPrefixes: z.array(z.string().min(1)).default(['.warrant/']),
  mode: z.enum(['SHADOW', 'ENFORCE']).default('SHADOW'),
});

export type CursorPolicy = z.infer<typeof cursorPolicySchema>;

const DEFAULT_POLICY: CursorPolicy = {
  protectedPathPrefixes: ['.warrant/', '.github/workflows/', '.husky/'],
  mode: 'SHADOW',
};

export function loadCursorPolicy(projectRoot: string): CursorPolicy {
  const filePath = path.join(projectRoot, '.warrant', 'cursor-policy.json');
  if (!fs.existsSync(filePath)) {
    return DEFAULT_POLICY;
  }
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return cursorPolicySchema.parse(raw);
}

export function pathMatchesProtectedPrefix(
  filePath: string,
  prefixes: readonly string[],
): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return prefixes.some((prefix) => normalized.includes(prefix.replace(/\\/g, '/')));
}
