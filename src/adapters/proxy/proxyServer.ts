import http from 'node:http';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { ToolOverride } from './classifyDiscoveredTool';
import { guardChatCompletion, UpstreamGuardError } from './guardChatCompletion';
import { ProxyGuardError } from './guardExchange';

export interface ProxyServerOptions {
  readonly mode: GuardMode;
  /** Base URL including `/v1`, e.g. `https://api.groq.com/openai/v1`. */
  readonly upstreamBaseUrl: string;
  readonly upstreamHeaders: Readonly<Record<string, string>>;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
  readonly host?: string;
  readonly port?: number;
  readonly onExchange?: (summary: {
    readonly blockedTools: readonly string[];
    readonly wouldBlockTools: readonly string[];
  }) => void;
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`;
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const text = (await readRequestBody(req)).toString('utf8');
  if (text.trim() === '') {
    return {};
  }
  return JSON.parse(text) as unknown;
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createWarrantProxyServer(options: ProxyServerOptions): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/health') {
        writeJson(res, 200, { ok: true, mode: options.mode });
        return;
      }

      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        writeJson(res, 404, { error: 'not_found' });
        return;
      }

      try {
        const requestBody = await readJsonBody(req);
        const result = await guardChatCompletion({
          mode: options.mode,
          upstreamUrl: joinUrl(options.upstreamBaseUrl, '/chat/completions'),
          upstreamHeaders: options.upstreamHeaders,
          requestBody,
          overrides: options.overrides,
        });

        options.onExchange?.({
          blockedTools: result.exchange.blockedTools,
          wouldBlockTools: result.exchange.wouldBlockTools,
        });

        writeJson(res, result.status, result.body);
      } catch (error) {
        if (error instanceof UpstreamGuardError) {
          writeJson(res, error.status, error.detail);
          return;
        }
        if (error instanceof ProxyGuardError) {
          writeJson(res, 502, { error: 'guard_parse_failed', message: error.message });
          return;
        }
        if (error instanceof SyntaxError) {
          writeJson(res, 400, { error: 'invalid_json' });
          return;
        }
        writeJson(res, 500, { error: 'proxy_internal' });
      }
    })();
  });
}

export function listenWarrantProxy(
  options: ProxyServerOptions,
): Promise<{ readonly server: http.Server; readonly url: string }> {
  const server = createWarrantProxyServer(options);
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('proxy failed to bind'));
        return;
      }
      resolve({ server, url: `http://${host}:${address.port}/v1` });
    });
  });
}
