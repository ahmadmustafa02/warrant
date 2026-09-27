process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf('\n');
  while (newline !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line !== '') {
      handle(JSON.parse(line.includes('{') ? line.slice(line.indexOf('{')) : line));
    }
    newline = buffer.indexOf('\n');
  }
});

function handle(msg) {
  if (msg.method === 'tools/list') {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [
            { name: 'read_document', inputSchema: { properties: { id: {} } } },
            { name: 'send_email', inputSchema: { properties: { to: {}, body: {} } } },
          ],
        },
      })}\n`,
    );
    return;
  }
  if (msg.method === 'tools/call') {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: `RAN:${msg.params.name}` }] },
      })}\n`,
    );
  }
}
