import { describe, expect, it } from 'vitest';
import { encodeMcpFrame, McpFrameDecoder } from './mcpFraming';

describe('McpFrameDecoder', () => {
  it('reads Content-Length frames split across chunks', () => {
    const decoder = new McpFrameDecoder();
    const frame = encodeMcpFrame(
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      'content-length',
    );
    const mid = Math.ceil(frame.length / 2);
    expect(decoder.push(frame.subarray(0, mid))).toEqual([]);
    const frames = decoder.push(frame.subarray(mid));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      framing: 'content-length',
      json: { method: 'ping', id: 1 },
    });
  });

  it('reads NDJSON', () => {
    const decoder = new McpFrameDecoder();
    const frames = decoder.push(Buffer.from('{"id":2}\n{"id":3}\n', 'utf8'));
    expect(frames.map((frame) => frame.json)).toEqual([{ id: 2 }, { id: 3 }]);
    expect(frames[0]?.framing).toBe('ndjson');
  });
});
