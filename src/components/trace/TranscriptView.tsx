import type { ChatMessage } from '@/llm/types';

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null || !('role' in value)) {
    return false;
  }
  const { role } = value;
  return (
    role === 'system' || role === 'user' || role === 'assistant' || role === 'tool'
  );
}

export function TranscriptView({ transcript }: { transcript: unknown }) {
  const messages = Array.isArray(transcript) ? transcript.filter(isChatMessage) : [];

  if (messages.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No transcript stored.</p>;
  }

  return (
    <ol className="space-y-3">
      {messages.map((message, index) => (
        <li key={`${message.role}-${index}`} className="surface rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            {message.role}
          </p>
          {message.role === 'assistant' && message.tool_calls ? (
            <ul className="mt-3 space-y-2 font-mono text-xs text-[var(--muted)]">
              {message.tool_calls.map((call) => (
                <li key={call.id}>
                  {call.function.name}({call.function.arguments})
                </li>
              ))}
            </ul>
          ) : null}
          {'content' in message && message.content ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
              {message.content}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
