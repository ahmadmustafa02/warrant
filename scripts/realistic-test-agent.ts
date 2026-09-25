/**
 * Typical custom agent shape (no Warrant imports):
 * - dotenv + OpenAI SDK
 * - tool definitions in the request
 * - local tool execution
 * - respects OPENAI_BASE_URL (so a proxy can sit in the middle)
 *
 * Run: npx tsx scripts/realistic-test-agent.ts "Summarize document doc-1"
 */
import 'dotenv/config';
import OpenAI from 'openai';
import { isGroqKeyRotationError, parseGroqApiKeys } from '../src/lib/groqKeys';

const USER_TASK =
  process.argv.slice(2).join(' ').trim() ||
  'Summarize document doc-1 in two sentences.';

const groqKeys = parseGroqApiKeys(process.env.GROQ_API_KEY?.trim() ?? '');
const openAiKey = process.env.OPENAI_API_KEY?.trim();
const proxyBase = process.env.OPENAI_BASE_URL?.trim();

const preferGroq = groqKeys.length > 0;
const MODEL = preferGroq
  ? (process.env.GROQ_TARGET_MODEL?.trim() ?? 'openai/gpt-oss-20b')
  : (process.env.OPENAI_MODEL?.trim() ?? 'gpt-4o-mini');

function createClient(apiKey: string): OpenAI {
  const baseURL =
    proxyBase !== undefined && proxyBase !== ''
      ? proxyBase
      : preferGroq
        ? 'https://api.groq.com/openai/v1'
        : undefined;
  return new OpenAI({ apiKey, baseURL });
}

if (!preferGroq && (openAiKey === undefined || openAiKey === '')) {
  throw new Error('Set GROQ_API_KEY and/or OPENAI_API_KEY in .env');
}

const DOCUMENTS: Readonly<Record<string, string>> = {
  'doc-1': 'Q3 report: Revenue grew 12% year over year. Operating costs were flat.',
};

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_document',
      description: 'Read the text of a document by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Document id' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a recipient.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'body'],
      },
    },
  },
];

function runTool(name: string, args: Record<string, unknown>): string {
  if (name === 'read_document') {
    const id = typeof args.id === 'string' ? args.id : '';
    const body = DOCUMENTS[id];
    if (body === undefined) {
      return JSON.stringify({ error: 'document_not_found', id });
    }
    return body;
  }
  if (name === 'send_email') {
    const to = typeof args.to === 'string' ? args.to : '';
    process.stderr.write(`[realistic-test-agent] send_email to=${to}\n`);
    return JSON.stringify({ ok: true, to });
  }
  return JSON.stringify({ error: 'unknown_tool', name });
}

async function createCompletion(body: {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const keys = preferGroq ? groqKeys : openAiKey !== undefined ? [openAiKey] : [];
  let lastError: Error | undefined;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) {
      continue;
    }
    try {
      return await createClient(key).chat.completions.create(body);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('chat failed');
      lastError = err;
      if (
        preferGroq &&
        isGroqKeyRotationError(err.message) &&
        index < keys.length - 1
      ) {
        process.stderr.write(
          `[realistic-test-agent] Groq key ${index + 1}/${keys.length} failed; trying next.\n`,
        );
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('No API key available');
}

async function main(): Promise<void> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are a document assistant. Use read_document when you need document text. Only send_email when the user explicitly asked you to email something.',
    },
    { role: 'user', content: USER_TASK },
  ];

  for (let step = 0; step < 10; step += 1) {
    const completion = await createCompletion({ model: MODEL, messages, tools });

    const choice = completion.choices[0]?.message;
    if (choice === undefined) {
      throw new Error('Model returned no message');
    }

    messages.push(choice);

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      process.stdout.write(`${choice.content ?? ''}\n`);
      return;
    }

    for (const call of toolCalls) {
      if (call.type !== 'function') {
        continue;
      }
      let args: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(call.function.arguments || '{}');
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          args = parsed;
        }
      } catch {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: 'invalid_tool_arguments' }),
        });
        continue;
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: runTool(call.function.name, args),
      });
    }
  }

  throw new Error('Exceeded max tool loop steps');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
