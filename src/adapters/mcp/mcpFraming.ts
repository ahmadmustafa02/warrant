/**
 * MCP stdio speaks either LSP-style Content-Length frames or one JSON object
 * per line. The proxy must understand both so a client and a server that
 * disagree on framing still work.
 */

export type McpFrame = {
  readonly json: unknown;
  readonly framing: 'content-length' | 'ndjson';
};

export function encodeMcpFrame(json: unknown, framing: McpFrame['framing']): Buffer {
  const body = JSON.stringify(json);
  if (framing === 'ndjson') {
    return Buffer.from(`${body}\n`, 'utf8');
  }
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'utf8'), Buffer.from(body, 'utf8')]);
}

export class McpFrameDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): readonly McpFrame[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: McpFrame[] = [];
    while (true) {
      const next = this.takeOne();
      if (next === undefined) {
        break;
      }
      frames.push(next);
    }
    return frames;
  }

  private takeOne(): McpFrame | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }

    const asText = this.buffer.toString('utf8');
    const contentLength = /^content-length:\s*(\d+)\r?\n\r?\n/i.exec(asText);
    if (contentLength !== null) {
      const headerBytes = Buffer.byteLength(contentLength[0], 'utf8');
      const length = Number.parseInt(contentLength[1] ?? '', 10);
      if (Number.isNaN(length) || this.buffer.length < headerBytes + length) {
        return undefined;
      }
      const body = this.buffer
        .subarray(headerBytes, headerBytes + length)
        .toString('utf8');
      this.buffer = this.buffer.subarray(headerBytes + length);
      return { json: JSON.parse(body) as unknown, framing: 'content-length' };
    }

    const newline = this.buffer.indexOf(0x0a);
    if (newline === -1) {
      return undefined;
    }
    const line = this.buffer.subarray(0, newline).toString('utf8').replace(/\r$/, '');
    this.buffer = this.buffer.subarray(newline + 1);
    if (line.trim() === '') {
      return this.takeOne();
    }
    return { json: JSON.parse(line) as unknown, framing: 'ndjson' };
  }
}
