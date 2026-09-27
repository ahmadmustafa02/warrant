/**
 * Walks tool-call arguments and removes unauthorized secrets from every string.
 *
 * The reply redactor never sees these values. An email body or a link inside a
 * payload would otherwise leave carrying the secret the reply itself no longer has.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Destination fields are pinned or stopped elsewhere. Rewriting them would change who the action reaches. */
const DESTINATION_KEY =
  /^(to|cc|bcc|recipient|recipients|email|address|send_to|mailto|mail_to|url|uri|endpoint|href|link|host|hostname|webhook|callback|src|path|filepath|phone)$|(?:_url|_uri|_href|_link|_to)$/i;

export function redactStringLeaves(
  value: unknown,
  redact: (text: string) => string,
): { readonly value: unknown; readonly changed: boolean } {
  if (typeof value === 'string') {
    const next = redact(value);
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const redacted = redactStringLeaves(entry, redact);
      changed = changed || redacted.changed;
      return redacted.value;
    });
    return { value: next, changed };
  }
  if (isRecord(value)) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const redacted = redactStringLeaves(entry, redact);
      changed = changed || redacted.changed;
      next[key] = redacted.value;
    }
    return { value: next, changed };
  }
  return { value, changed: false };
}

/** Redacts payload strings. Destination fields are left unchanged. */
export function redactArgumentRecord(
  value: unknown,
  redact: (text: string) => string,
): { readonly value: unknown; readonly changed: boolean } {
  if (!isRecord(value)) {
    return redactStringLeaves(value, redact);
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (DESTINATION_KEY.test(key)) {
      next[key] = entry;
      continue;
    }
    const redacted = redactStringLeaves(entry, redact);
    changed = changed || redacted.changed;
    next[key] = redacted.value;
  }
  return { value: next, changed };
}

/** Redacts inside a JSON argument string. Invalid JSON is left unchanged. */
export function redactArgumentJson(
  raw: string,
  redact: (text: string) => string,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
  const redacted = redactArgumentRecord(parsed, redact);
  if (!redacted.changed) {
    return raw;
  }
  return JSON.stringify(redacted.value);
}
