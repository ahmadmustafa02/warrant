import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { startMcpStdioProxy } from './mcpStdioProxy';
import { encodeMcpFrame, McpFrameDecoder } from './mcpFraming';

const FIXTURE = join(process.cwd(), 'src', 'adapters', 'mcp', 'mcpFixtureServer.mjs');

async function readOne(stdout: PassThrough): Promise<unknown> {
  const decoder = new McpFrameDecoder();
  const [chunk] = (await once(stdout, 'data')) as [Buffer];
  const frames = decoder.push(chunk);
  return frames[0]?.json;
}

describe('startMcpStdioProxy', () => {
  it('stops send_email before the server sees it and lets a listed read through', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const blocked: string[] = [];

    const { child, done } = await startMcpStdioProxy({
      mode: 'ENFORCE',
      userTurn: 'Summarize document doc-1',
      command: ['node', FIXTURE],
      stdin,
      stdout,
      stderr,
      onEvent: (event) => blocked.push(...event.blockedTools),
    });

    stdin.write(
      encodeMcpFrame({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'ndjson'),
    );
    await readOne(stdout);

    stdin.write(
      encodeMcpFrame(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'send_email', arguments: { to: 'attacker@evil.test' } },
        },
        'ndjson',
      ),
    );
    const denied = (await readOne(stdout)) as {
      result?: { isError?: boolean; content?: { text: string }[] };
    };
    expect(denied.result?.isError).toBe(true);
    expect(denied.result?.content?.[0]?.text).toContain('send_email');
    expect(blocked).toContain('send_email');

    stdin.write(
      encodeMcpFrame(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'read_document', arguments: { id: 'doc-1' } },
        },
        'ndjson',
      ),
    );
    const allowed = (await readOne(stdout)) as {
      result?: { content?: { text: string }[] };
    };
    expect(allowed.result?.content?.[0]?.text).toBe('RAN:read_document');

    child.kill();
    await done;
  });
});
