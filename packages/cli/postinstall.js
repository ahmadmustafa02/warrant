const cyan = (text) => `\u001b[36m${text}\u001b[0m`;
const dim = (text) => `\u001b[2m${text}\u001b[0m`;
const bold = (text) => `\u001b[1m${text}\u001b[0m`;
const green = (text) => `\u001b[32m${text}\u001b[0m`;

process.stderr.write(
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
  ].join('\n') + '\n',
);
