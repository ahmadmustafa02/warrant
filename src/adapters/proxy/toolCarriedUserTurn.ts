/**
 * A user message that is really the tool's reply.
 *
 * Some frameworks never send `role: "tool"`. smolagents pastes the observation
 * into the next user message, right after an assistant turn that records the
 * call. Anthropic puts `tool_result` blocks inside a user message. Those turns
 * must not become the warrant. A person who speaks after a finished tool call
 * still does: their message does not sit directly on the call.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOf(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .filter((text) => text !== '')
    .join('\n');
}

function contentHasToolResult(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some((part) => isRecord(part) && part.type === 'tool_result')
  );
}

function assistantInvokedTool(message: {
  readonly content?: unknown;
  readonly tool_calls?: readonly unknown[];
}): boolean {
  if (message.tool_calls !== undefined && message.tool_calls.length > 0) {
    return true;
  }
  if (
    Array.isArray(message.content) &&
    message.content.some(
      (part) =>
        isRecord(part) && (part.type === 'tool_use' || part.type === 'tool_call'),
    )
  ) {
    return true;
  }
  // smolagents stringifies the call into the assistant turn instead of tool_calls.
  return textOf(message.content).includes('Calling tools:');
}

export interface TurnMessage {
  readonly role: string;
  readonly content?: unknown;
  readonly tool_calls?: readonly unknown[];
}

/** True when this user message is the tool observation, not the person. */
export function messageCarriesToolOutput(
  message: TurnMessage,
  previous: TurnMessage | undefined,
): boolean {
  if (message.role !== 'user') {
    return false;
  }
  if (contentHasToolResult(message.content)) {
    return true;
  }
  return previous?.role === 'assistant' && assistantInvokedTool(previous);
}

/** Index of the last user message that can grant a tool. -1 when there is none. */
export function authoritativeUserIndex(messages: readonly TurnMessage[]): number {
  let found = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined || message.role !== 'user') {
      continue;
    }
    if (messageCarriesToolOutput(message, messages[index - 1])) {
      continue;
    }
    found = index;
  }
  return found;
}

/** Index of the last user message that is tool output. -1 when the agent used role tool. */
export function lastToolCarriedUserIndex(messages: readonly TurnMessage[]): number {
  let found = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined) {
      continue;
    }
    if (messageCarriesToolOutput(message, messages[index - 1])) {
      found = index;
    }
  }
  return found;
}
