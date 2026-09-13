import type { UserIntent } from '@/core/authorization/warrant';
import type { ToolRegistry } from '@/core/tools/registry';
import { deriveProxyIntent } from '@/adapters/proxy/deriveProxyIntent';
import {
  parseUserIntentWithLlm,
  type IntentParseMode,
  IntentParseError,
} from './parseUserIntentLlm';

/**
 * Builds the warrant input for one proxy exchange.
 *
 * Heuristic mode stays synchronous and network-free. LLM mode reads only the user
 * turn and falls back to the heuristic when the parser errors, so ENFORCE never
 * widens authorization because OpenAI was down.
 */
export async function resolveProxyIntent(options: {
  readonly mode: IntentParseMode;
  readonly userRequest: string;
  readonly registry: ToolRegistry;
  readonly destructiveRequiresExplicitUser: boolean;
}): Promise<UserIntent> {
  if (options.mode === 'heuristic') {
    return deriveProxyIntent(options.userRequest, options.registry);
  }

  const allowedToolNames = options.registry.list().map((tool) => tool.name);
  try {
    return await parseUserIntentWithLlm({
      userTurn: options.userRequest,
      allowedToolNames,
      registry: options.registry,
      destructiveRequiresExplicitUser: options.destructiveRequiresExplicitUser,
    });
  } catch (error) {
    if (error instanceof IntentParseError) {
      return deriveProxyIntent(options.userRequest, options.registry);
    }
    throw error;
  }
}
