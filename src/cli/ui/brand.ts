import pc from 'picocolors';

export const BRAND = 'Warrant';

export function warrantBanner(subtitle?: string): string {
  const title = pc.bold(pc.cyan('◆ Warrant'));
  const tag = pc.dim('provenance guard for agent tool calls');
  const sub = subtitle === undefined ? '' : `\n${pc.white(subtitle)}`;
  return `${title}  ${tag}${sub}`;
}

export function warrantRule(width = 52): string {
  return pc.dim('─'.repeat(width));
}

export function statusOk(label: string): string {
  return `${pc.green('✔')} ${label}`;
}

export function statusWarn(label: string): string {
  return `${pc.yellow('▲')} ${label}`;
}

export function statusFail(label: string): string {
  return `${pc.red('✖')} ${label}`;
}

export function modeBadge(mode: string): string {
  switch (mode) {
    case 'ENFORCE':
      return pc.bgCyan(pc.black(` ${mode} `));
    case 'DETECT_ONLY':
      return pc.bgYellow(pc.black(` ${mode} `));
    case 'OFF':
      return pc.bgRed(pc.white(` ${mode} `));
    default:
      return pc.dim(mode);
  }
}
