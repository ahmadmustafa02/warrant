export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCallRequest[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCallRequest = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ToolDefinitionForApi = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
