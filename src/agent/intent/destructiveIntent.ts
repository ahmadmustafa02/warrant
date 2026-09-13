import { tokenizeToolName } from '@/adapters/proxy/classifyDiscoveredTool';

const DESTRUCTIVE_VERBS = new Set([
  'delete',
  'remove',
  'drop',
  'destroy',
  'purge',
  'refund',
  'transfer',
  'wire',
]);

function mentions(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

/** True when the user's own words explicitly name a destructive action or tool. */
export function userNamedDestructiveTool(userTurn: string, toolName: string): boolean {
  const text = userTurn.toLowerCase();
  const flattened = text.replace(/[^a-z0-9]+/g, '');
  if (flattened.includes(toolName.toLowerCase().replace(/[^a-z0-9]+/g, ''))) {
    return true;
  }
  const tokens = tokenizeToolName(toolName);
  return tokens.some((token) => DESTRUCTIVE_VERBS.has(token) && mentions(text, token));
}
