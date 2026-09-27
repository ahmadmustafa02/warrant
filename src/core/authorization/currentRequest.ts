/**
 * Text that may grant a tool on this turn.
 *
 * Callers pass only the latest user message. A saved note or an older chat that
 * was pasted into that message is not part of the request: it cannot authorize a
 * send, a delete, or a payment. If the paste is the whole message, nothing
 * consequential is authorized.
 */

const TAGGED_NAME =
  'memory|retrieved_memory|long_term_memory|conversation_history|chat_history|previous_messages|prior_messages|agent_memory|retrieved_context|stored_memory';

const BALANCED_REGION = new RegExp(
  `<(${TAGGED_NAME})\\b[^>]*>[\\s\\S]*?<\\/\\1>`,
  'gi',
);

const UNCLOSED_REGION = new RegExp(`<(?:${TAGGED_NAME})\\b[^>]*>[\\s\\S]*$`, 'i');

const CURRENT_MARKER =
  /\b(?:current(?:\s+user)?\s+request|current\s+user\s+message|latest\s+user\s+message|new\s+user\s+message)\s*:\s*/gi;

const HISTORY_HEADER =
  /^(?:conversation history|chat history|previous conversation|prior messages|retrieved memory|long-term memory|agent memory|stored memory)\s*:/im;

const STORED_PART_TYPES = new Set([
  'memory',
  'history',
  'retrieved_memory',
  'retrieved_context',
  'conversation_history',
  'chat_history',
  'stored_memory',
]);

/** A content part whose type says it is saved context, not the human's new words. */
export function isStoredContextPart(type: string | undefined): boolean {
  if (type === undefined || type === '') {
    return false;
  }
  const key = type.toLowerCase().replace(/[\s-]+/g, '_');
  return STORED_PART_TYPES.has(key);
}

function stripTaggedRegions(text: string): string {
  let out = text;
  let previous = '';
  while (out !== previous) {
    previous = out;
    BALANCED_REGION.lastIndex = 0;
    out = out.replace(BALANCED_REGION, ' ');
  }
  return out.replace(UNCLOSED_REGION, ' ');
}

function textAfterLastMarker(text: string): string | undefined {
  CURRENT_MARKER.lastIndex = 0;
  let end: number | undefined;
  for (const match of text.matchAll(CURRENT_MARKER)) {
    if (match.index !== undefined) {
      end = match.index + match[0].length;
    }
  }
  return end === undefined ? undefined : text.slice(end);
}

/**
 * A history header introduces a saved transcript. The paragraph under that
 * header is not this turn. Text after the following blank line is.
 * A transcript with no separate request authorizes nothing.
 */
function dropHistoryParagraph(text: string): string {
  HISTORY_HEADER.lastIndex = 0;
  const header = HISTORY_HEADER.exec(text);
  if (header === null || header.index === undefined) {
    return text;
  }
  const lineEnd = text.indexOf('\n', header.index);
  if (lineEnd < 0) {
    return '';
  }
  const rest = text.slice(lineEnd + 1);
  const blank = rest.search(/\n\s*\n/);
  if (blank < 0) {
    return '';
  }
  return rest.slice(blank);
}

export function permissionTextFromUserMessage(userMessage: string): string {
  const untagged = stripTaggedRegions(userMessage);
  const marked = textAfterLastMarker(untagged);
  const request = marked === undefined ? dropHistoryParagraph(untagged) : marked;
  return request.replace(/[ \t]+\n/g, '\n').trim();
}
