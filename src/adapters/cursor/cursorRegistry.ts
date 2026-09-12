import { ToolRegistry, type ToolDefinition } from '@/core/tools/registry';

const CURSOR_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'shell_network',
    riskTier: 'SENSITIVE',
    description: 'Shell command that reaches an external network host or URL.',
    authorityParameters: ['target'],
    observedParameters: ['target'],
  },
  {
    name: 'mcp_invoke',
    riskTier: 'SENSITIVE',
    description: 'Invocation of an MCP tool exposed to the agent.',
    authorityParameters: ['tool'],
    observedParameters: ['tool', 'server'],
  },
  {
    name: 'write_protected_path',
    riskTier: 'DESTRUCTIVE',
    description: 'Write or edit under a protected project path.',
    authorityParameters: ['path'],
    observedParameters: ['path'],
  },
];

export function createCursorRegistry(): ToolRegistry {
  return new ToolRegistry(CURSOR_TOOL_DEFINITIONS);
}
