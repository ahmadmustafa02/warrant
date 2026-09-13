import { z } from 'zod';

const streamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        index: z.number().optional(),
        delta: z
          .object({
            role: z.string().optional(),
            content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number().optional(),
                  id: z.string().optional(),
                  type: z.literal('function').optional(),
                  function: z
                    .object({
                      name: z.string().optional(),
                      arguments: z.string().optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  id: z.string().optional(),
  model: z.string().optional(),
  object: z.string().optional(),
});

export interface AssembledOpenAiCompletion {
  readonly id: string;
  readonly model: string;
  readonly message: {
    readonly role: 'assistant';
    readonly content: string | null;
    readonly tool_calls?: readonly {
      readonly id: string;
      readonly type: 'function';
      readonly function: { readonly name: string; readonly arguments: string };
    }[];
  };
  readonly finish_reason: string | null;
}

/** Parses OpenAI SSE into one chat.completion-shaped object for the guard. */
export function assembleOpenAiCompletionFromSse(
  sseText: string,
): AssembledOpenAiCompletion {
  let id = 'warrant-stream';
  let model = 'unknown';
  let content = '';
  let finishReason: string | null = null;

  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

  for (const line of sseText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      continue;
    }
    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      break;
    }

    let json: unknown;
    try {
      json = JSON.parse(payload) as unknown;
    } catch {
      continue;
    }

    const parsed = streamChunkSchema.safeParse(json);
    if (!parsed.success) {
      continue;
    }

    if (parsed.data.id !== undefined) {
      id = parsed.data.id;
    }
    if (parsed.data.model !== undefined) {
      model = parsed.data.model;
    }

    const choice = parsed.data.choices?.[0];
    if (choice === undefined) {
      continue;
    }

    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      finishReason = choice.finish_reason;
    }

    const delta = choice.delta;
    if (delta?.content !== undefined && delta.content !== null) {
      content += delta.content;
    }

    for (const call of delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      let entry = toolCalls.get(index);
      if (entry === undefined) {
        entry = {
          id: call.id ?? `call_${index}`,
          name: call.function?.name ?? '',
          arguments: call.function?.arguments ?? '',
        };
        toolCalls.set(index, entry);
        continue;
      }
      if (call.id !== undefined) {
        entry.id = call.id;
      }
      if (call.function?.name !== undefined) {
        entry.name = call.function.name;
      }
      if (call.function?.arguments !== undefined) {
        entry.arguments += call.function.arguments;
      }
    }
  }

  const calls = [...toolCalls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => ({
      id: call.id,
      type: 'function' as const,
      function: { name: call.name, arguments: call.arguments },
    }))
    .filter((call) => call.function.name !== '');

  const message: AssembledOpenAiCompletion['message'] = {
    role: 'assistant',
    content: content === '' ? null : content,
    ...(calls.length > 0 ? { tool_calls: Object.freeze(calls) } : {}),
  };

  return {
    id,
    model,
    message,
    finish_reason: finishReason,
  };
}

export function openAiCompletionToChatResponse(
  assembled: AssembledOpenAiCompletion,
): unknown {
  return {
    id: assembled.id,
    object: 'chat.completion',
    model: assembled.model,
    choices: [
      {
        index: 0,
        message: assembled.message,
        finish_reason: assembled.finish_reason,
      },
    ],
  };
}

/** Re-encodes a guarded chat.completion as SSE for clients that requested stream: true. */
export function chatCompletionToOpenAiSse(body: unknown): string {
  const text = JSON.stringify(body);
  return `data: ${text}\n\ndata: [DONE]\n`;
}

export async function readResponseText(response: Response): Promise<string> {
  return response.text();
}
