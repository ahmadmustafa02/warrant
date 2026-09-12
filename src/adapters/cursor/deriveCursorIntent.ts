import type { UserIntent } from '@/core/authorization/warrant';

const URL_IN_TEXT =
  /\bhttps?:\/\/[^\s"'<>]+|\b[\w.-]+\.(com|net|org|io|dev|test)(?:\/[^\s"'<>]*)?/i;

/**
 * Heuristic intent for Cursor boundary checks — not a product-grade parser.
 * Grants only capabilities the user's prompt plausibly names.
 */
export function deriveCursorIntentFromPrompt(prompt: string): UserIntent {
  const text = prompt.toLowerCase();
  const requestedTools: string[] = [];
  const pinnedParameters: Record<string, Record<string, string>> = {};

  const wantsNetworkShell =
    /\b(curl|wget|fetch|download|invoke-webrequest|iwr\b|npm install|pnpm add)\b/.test(
      text,
    );
  if (wantsNetworkShell) {
    requestedTools.push('shell_network');
    const urlMatch = prompt.match(URL_IN_TEXT);
    if (urlMatch?.[0]) {
      pinnedParameters['shell_network'] = { target: urlMatch[0] };
    }
  }

  if (/\bmcp\b/.test(text) || /\btool call\b/.test(text)) {
    requestedTools.push('mcp_invoke');
  }

  return {
    requestedTools,
    ...(Object.keys(pinnedParameters).length > 0 ? { pinnedParameters } : {}),
  };
}
