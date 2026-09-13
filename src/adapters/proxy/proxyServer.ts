import http from 'node:http';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { ToolOverride } from './classifyDiscoveredTool';
import { guardChatCompletion, UpstreamGuardError } from './guardChatCompletion';
import { ProxyGuardError } from './guardExchange';
import { ProxySession } from './proxySession';
import type { AdvertisedTool, ToolDrift } from '@/core/tools/toolSetDrift';

export interface ProxyServerOptions {
  readonly mode: GuardMode;
  /** Base URL including `/v1`, e.g. `https://api.groq.com/openai/v1`. */
  readonly upstreamBaseUrl: string;
  readonly upstreamHeaders: Readonly<Record<string, string>>;
  readonly overrides?: Readonly<Record<string, ToolOverride>>;
  readonly host?: string;
  readonly port?: number;
  /**
   * Expected tool set from policy. When given, even the first request is checked,
   * which matters because an agent's opening request can already be poisoned.
   */
  readonly pinnedTools?: readonly AdvertisedTool[];
  readonly onExchange?: (summary: {
    readonly blockedTools: readonly string[];
    readonly wouldBlockTools: readonly string[];
    readonly drifts: readonly ToolDrift[];
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

/** Prefer the agent's Authorization header so the child can supply the key from dotenv. */
function resolveUpstreamHeaders(
  req: http.IncomingMessage,
  defaults: Readonly<Record<string, string>>,
): Record<string, string> {
  const incomingAuth = req.headers.authorization;
  if (typeof incomingAuth === 'string' && incomingAuth.trim() !== '') {
    return { ...defaults, authorization: incomingAuth };
  }
  return { ...defaults };
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
  // One session per server: a `warrant guard` run wraps a single agent process, so
  // the capability surface observed first is the one that run is entitled to.
  const session = new ProxySession(options.pinnedTools);

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
          upstreamHeaders: resolveUpstreamHeaders(req, options.upstreamHeaders),
          requestBody,
          overrides: options.overrides,
          session,
        });

        options.onExchange?.({
          blockedTools: result.exchange.blockedTools,
          wouldBlockTools: result.exchange.wouldBlockTools,
          drifts: result.exchange.drifts,
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
