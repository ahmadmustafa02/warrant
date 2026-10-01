import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const cyan = (text) => `\u001b[36m${text}\u001b[0m`;
const dim = (text) => `\u001b[2m${text}\u001b[0m`;
const bold = (text) => `\u001b[1m${text}\u001b[0m`;
const green = (text) => `\u001b[32m${text}\u001b[0m`;

const banner =
  [
    '',
    `  ${bold(cyan('◆ Warrant'))}  ${dim('provenance guard for agent tool calls')}`,
    '',
    `  ${green('✔')} Installed.`,
    '',
    '  Next:',
    `    ${cyan('warrant scan --')} <your agent>`,
    `    ${cyan('warrant guard --')} <your agent>`,
    '',
  ].join('\n') + '\n';

if (process.platform === 'win32') {
  spawnSync('chcp.com', ['65001'], { stdio: 'ignore' });
}

const consoles = process.platform === 'win32' ? ['\\\\.\\CON'] : ['/dev/tty'];

for (const target of consoles) {
  try {
    const fd = fs.openSync(target, 'w');
    fs.writeSync(fd, banner);
    fs.closeSync(fd);
    process.exit(0);
  } catch {
    // npm may have no console. Fall through to stderr.
  }
}

process.stderr.write(banner);
