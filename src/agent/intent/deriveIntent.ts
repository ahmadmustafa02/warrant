import type { UserIntent } from '@/core/authorization/warrant';

/**
 * Derives authorized tools from the user turn alone, before any document is read.
 *
 * A full LLM-based intent parser will replace this for ambiguous requests; the
 * heuristic exists so unit tests and the default demo case stay deterministic and
 * free of network calls.
 */
export function deriveIntentFromUserTurn(userTurn: string): UserIntent {
  const text = userTurn.toLowerCase();
  const requestedTools: string[] = [];
  const pinnedParameters: Record<string, Record<string, string>> = {};

  const wantsDocument =
    /\bdocument\b/.test(text) ||
    /\bdoc-\d+\b/.test(text) ||
    /\bsummari(z|s)e\b/.test(text);
  if (wantsDocument) {
    requestedTools.push('read_document');
    const docMatch = userTurn.match(/\b(doc-\d+)\b/i);
    if (docMatch?.[1]) {
      pinnedParameters['read_document'] = { id: docMatch[1] };
    }
  }

  // `send_email` must match too: the underscore is a word character, so \bsend\b
  // never fires on it, and a user naming the tool outright is still the authority.
  if (
    /\bsend_email\b/.test(text) ||
    /\bsend\b.*\bemail\b/.test(text) ||
    /\bemail\b.*\b(send|to)\b/.test(text)
  ) {
    requestedTools.push('send_email');
    const emailMatch = userTurn.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch?.[0]) {
      pinnedParameters['send_email'] = { to: emailMatch[0] };
    }
  }

  if (
    /\bread_memory\b/.test(text) ||
    /\b(memory|memories|remember|recall)\b/.test(text)
  ) {
    requestedTools.push('read_memory');
  }

  if (/\b(delegate|worker|subagent|sub-agent)\b/.test(text)) {
    requestedTools.push('delegate_worker');
  }

  if (/\bapi[\s_]*key\b/.test(text) || /\bget_api_key\b/.test(text)) {
    requestedTools.push('get_api_key');
  }

  if (/\bfetch_url\b/.test(text) || /\bfetch\b.*\b(https?:\/\/\S+)/i.test(userTurn)) {
    requestedTools.push('fetch_url');
    const urlMatch = userTurn.match(/\bhttps?:\/\/[^\s"'<>]+/i);
    const rawUrl = urlMatch?.[0]?.replace(/[.,;:!?)]+$/, '');
    if (rawUrl !== undefined && rawUrl.length > 0) {
      pinnedParameters['fetch_url'] = { url: rawUrl };
    }
  }

  return {
    requestedTools,
    ...(Object.keys(pinnedParameters).length > 0 ? { pinnedParameters } : {}),
  };
}
