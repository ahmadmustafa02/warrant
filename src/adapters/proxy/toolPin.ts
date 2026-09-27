import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AdvertisedTool } from '@/core/tools/toolSetDrift';
import { pinnedToolsFromPolicy, type ProxyPolicy } from './proxyPolicy';

const toolPinSchema = z.object({
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        parameterNames: z.array(z.string()),
      }),
    )
    .min(1),
});

export function toolPinPath(projectRoot: string): string {
  return path.join(projectRoot, '.warrant', 'tool-pin.json');
}

/** The tool list saved after a trusted run. Missing or invalid files mean "not saved yet". */
export function loadToolPin(
  projectRoot: string,
): readonly AdvertisedTool[] | undefined {
  const filePath = toolPinPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
  const parsed = toolPinSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.tools;
}

export function saveToolPin(
  projectRoot: string,
  tools: readonly AdvertisedTool[],
): void {
  if (tools.length === 0) {
    return;
  }
  const directory = path.join(projectRoot, '.warrant');
  fs.mkdirSync(directory, { recursive: true });
  const body = toolPinSchema.parse({
    tools: tools.map((tool) => ({
      name: tool.name,
      parameterNames: [...tool.parameterNames],
    })),
  });
  fs.writeFileSync(
    toolPinPath(projectRoot),
    `${JSON.stringify(body, null, 2)}\n`,
    'utf8',
  );
}

/**
 * A saved pin wins over the policy list, because an approval updates the saved pin.
 * The policy list is only the seed for a project that has never saved one.
 */
export function resolveToolPin(
  projectRoot: string,
  policy: ProxyPolicy,
): readonly AdvertisedTool[] | undefined {
  return loadToolPin(projectRoot) ?? pinnedToolsFromPolicy(policy);
}
