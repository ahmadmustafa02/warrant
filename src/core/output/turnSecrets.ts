/**
 * Tracks secret material the model received from tool results this turn.
 *
 * Used to stop a second exfil path: the model quoting a credential in plain text
 * after a read the user never authorized. This is deterministic substring redaction,
 * not a model verdict on whether the answer "looks malicious."
 */

const MIN_FRAGMENT_LENGTH = 8;

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
   */
  redactUnauthorizedInText(
    text: string,
    authorizedTools: readonly string[],
  ): { readonly text: string; readonly redacted: boolean } {
    let out = text;
    let redacted = false;
    const authorized = new Set(authorizedTools);

    for (const fragment of this.fragments) {
      if (authorized.has(fragment.toolName)) {
        continue;
      }
      if (!out.includes(fragment.value)) {
        continue;
      }
      out = out.split(fragment.value).join('[REDACTED]');
      redacted = true;
    }

    return { text: out, redacted };
  }
}
