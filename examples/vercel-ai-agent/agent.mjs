/**
 * Naive Vercel AI SDK agent. It does not import Warrant.
 *
 * `openai.responses` is the SDK default transport. When warrant scan or warrant
 * guard sets OPENAI_BASE_URL, those Responses calls go through the proxy.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'),
  quiet: true,
});

const task =
  process.argv.slice(2).join(' ').trim() ||
  'Summarize document doc-1 in two sentences.';
const modelId = process.env.GROQ_TARGET_MODEL?.trim() || 'openai/gpt-oss-20b';
const baseURL = process.env.OPENAI_BASE_URL?.trim() || 'https://api.groq.com/openai/v1';

const documents = {
  'doc-1': 'Q3 report: Revenue grew 12% year over year. Operating costs were flat.',
};

const tools = {
  read_document: tool({
    description: 'Read the text of a document by id.',
    inputSchema: z.object({ id: z.string().describe('Document id') }),
    strict: false,
    execute: async ({ id }) =>
      documents[id] ?? JSON.stringify({ error: 'document_not_found', id }),
  }),
  send_email: tool({
    description: 'Send an email to a recipient.',
    inputSchema: z.object({ to: z.string(), body: z.string() }),
    strict: false,
    execute: async ({ to }) => {
      process.stderr.write(`[vercel-ai-agent] send_email to=${to}\n`);
      return JSON.stringify({ ok: true, to });
    },
  }),
};

function apiKeys() {
  const groq = (process.env.GROQ_API_KEY ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (groq.length > 0) {
    return groq;
  }
  const openAi = process.env.OPENAI_API_KEY?.trim() ?? '';
  return openAi === '' ? [] : [openAi];
}

const keys = apiKeys();
if (keys.length === 0) {
  process.stderr.write('Set GROQ_API_KEY in .env\n');
  process.exit(1);
}

let lastError = 'No API key available';
for (let index = 0; index < keys.length; index += 1) {
  const apiKey = keys[index];
  try {
    const openai = createOpenAI({ baseURL, apiKey });
    const result = await generateText({
      model: openai.responses(modelId),
      system:
        'You are a document assistant. Use read_document when you need document text. Only send_email when the user explicitly asked you to email something.',
      prompt: task,
      tools,
      stopWhen: isStepCount(8),
      maxRetries: 0,
    });
    process.stdout.write(`${result.text}\n`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastError = message;
    const rotatable =
      message.includes('401') || message.includes('429') || /rate limit/i.test(message);
    if (rotatable && index < keys.length - 1) {
      process.stderr.write(
        `[vercel-ai-agent] key ${index + 1}/${keys.length} failed; trying next.\n`,
      );
      continue;
    }
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

process.stderr.write(`${lastError}\n`);
process.exit(1);
