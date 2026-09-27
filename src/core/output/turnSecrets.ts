/**
 * Tracks secret material the model received from tool results this turn.
 *
 * Used to stop a second exfil path: the model quoting a credential in plain text
 * after a read the user never authorized. This is deterministic substring redaction,
 * not a model verdict on whether the answer "looks malicious."
 */

const MIN_FRAGMENT_LENGTH = 8;

/**
 * Spaces, dashes, and invisible characters are ignored when comparing a secret
 * to text. A model can retype `sk_live_ABC` as `sk live ABC` or `s k _ l i v e`.
 * Letters themselves still have to appear in order, so ordinary sentences do not
 * match an API key.
 */
const IGNORED_IN_SECRET = /[\s\u200b\u200c\u200d\ufeff_-]/;

const REDACTED = '[REDACTED]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pulls high-entropy strings out of a tool result for redaction matching. */
export function secretFragmentsFromToolResult(result: string): readonly string[] {
  const fragments = new Set<string>();

  const trimmed = result.trim();
  if (trimmed.length >= MIN_FRAGMENT_LENGTH) {
    fragments.add(trimmed);
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      for (const key of ['value', 'secret', 'token', 'api_key', 'apiKey', 'key']) {
        const entry = parsed[key];
        if (typeof entry === 'string' && entry.length >= MIN_FRAGMENT_LENGTH) {
          fragments.add(entry);
        }
      }
    }
  } catch {
    // Plain-text tool results are scanned as a whole string above.
  }

  return Object.freeze([...fragments].sort((a, b) => b.length - a.length));
}

export interface SecretFragment {
  readonly toolName: string;
  readonly value: string;
}

export class TurnSecretTracker {
  private readonly fragments: SecretFragment[] = [];

  recordToolResult(toolName: string, result: string, returnsSecrets: boolean): void {
    if (!returnsSecrets) {
      return;
    }
    for (const value of secretFragmentsFromToolResult(result)) {
      if (
        !this.fragments.some(
          (entry) => entry.value === value && entry.toolName === toolName,
        )
      ) {
        this.fragments.push({ toolName, value });
      }
    }
  }

  /**
   * Removes secret substrings that came from tools this turn did not authorize.
   *
   * Authorized secret reads (the user explicitly asked for a key) stay visible.
   * `[REDACTED]` is the visible notice that a value was removed. A secret retyped
   * with spaces or dropped dashes is removed too.
   */
  redactUnauthorizedInText(
    text: string,
    authorizedTools: readonly string[],
  ): { readonly text: string; readonly redacted: boolean } {
    let out = text;
    let redacted = false;

    for (const fragment of this.unauthorizedFragments(authorizedTools)) {
      const next = redactFragment(out, fragment.value);
      if (next === out) {
        continue;
      }
      out = next;
      redacted = true;
    }

    return { text: out, redacted };
  }

  /** True when `text` still carries a secret this turn did not authorize. */
  containsUnauthorizedSecret(
    text: string,
    authorizedTools: readonly string[],
  ): boolean {
    return this.unauthorizedFragments(authorizedTools).some(
      (fragment) => redactFragment(text, fragment.value) !== text,
    );
  }

  private unauthorizedFragments(
    authorizedTools: readonly string[],
  ): readonly SecretFragment[] {
    const authorized = new Set(authorizedTools);
    return this.fragments.filter((fragment) => !authorized.has(fragment.toolName));
  }
}

function isIgnoredInSecret(char: string): boolean {
  return IGNORED_IN_SECRET.test(char);
}

function compactSecret(value: string): string {
  return [...value]
    .filter((char) => !isIgnoredInSecret(char))
    .join('')
    .toLowerCase();
}

/**
 * Replaces one secret, including a copy that only differs by spaces or dashes.
 * The span in the original text is what gets removed, so the surrounding words stay.
 */
function redactFragment(text: string, secret: string): string {
  const needle = compactSecret(secret);
  if (needle.length < MIN_FRAGMENT_LENGTH) {
    return text;
  }

  let out = text;
  let searchFrom = 0;
  while (searchFrom < out.length) {
    const compactChars: { readonly index: number; readonly char: string }[] = [];
    for (let index = searchFrom; index < out.length; index += 1) {
      const char = out[index] ?? '';
      if (isIgnoredInSecret(char)) {
        continue;
      }
      compactChars.push({ index, char: char.toLowerCase() });
    }

    const compact = compactChars.map((entry) => entry.char).join('');
    const at = compact.indexOf(needle);
    if (at < 0) {
      break;
    }
    const start = compactChars[at]?.index;
    const end = compactChars[at + needle.length - 1]?.index;
    if (start === undefined || end === undefined) {
      break;
    }
    out = `${out.slice(0, start)}${REDACTED}${out.slice(end + 1)}`;
    searchFrom = start + REDACTED.length;
  }

  return out;
}
