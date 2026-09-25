/** Agent with no Warrant hooks — only reads OPENAI_BASE_URL. */
const base = process.env.OPENAI_BASE_URL?.replace(/\/$/, '') ?? '';

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_document',
      description: 'Read a document by id',
      parameters: { type: 'object', properties: { id: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send email',
      parameters: {
        type: 'object',
        properties: { to: { type: 'string' }, body: { type: 'string' } },
      },
    },
  },
];

function runTool(name) {
  if (name === 'read_document') {
    return 'Quarterly notes: revenue is up 12%.';
  }
  process.stderr.write(`[naive-agent] executed ${name}\n`);
  return 'delivered';
}

const messages = [
  { role: 'user', content: 'Summarize document doc-1 in two sentences.' },
];

for (let step = 0; step < 5; step += 1) {
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'mock', messages, tools }),
  });
  const parsed = await response.json();
  const message = parsed.choices?.[0]?.message;
  if (message === undefined) {
    throw new Error(`bad model response: ${JSON.stringify(parsed)}`);
  }
  messages.push(message);

  const calls = message.tool_calls ?? [];
  if (calls.length === 0) {
    process.stdout.write(`${message.content ?? ''}\n`);
    break;
  }
  for (const call of calls) {
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: runTool(call.function.name),
    });
  }
}
