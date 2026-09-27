/**
 * Where an email address is allowed to come from.
 *
 * The user may type the address, or name a person and have a contacts lookup
 * resolve it. Text from a document, page, or other tool result must not choose
 * the recipient. When the proxy cannot see either source, it asks instead of
 * guessing.
 */

const EMAIL_PATTERN = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;

/** A directory dump that merely mentions the name is not a lookup of that person. */
const SHORT_LOOKUP_RECORD_CHARS = 400;

const LOOKUP_VERBS = new Set([
  'lookup',
  'find',
  'search',
  'resolve',
  'get',
  'query',
  'fetch',
]);

const LOOKUP_NOUNS = new Set([
  'contact',
  'contacts',
  'directory',
  'addressbook',
  'recipient',
  'person',
  'people',
  'member',
  'customer',
  'user',
  'email',
  'address',
]);

const CONTENT_PARAMETER_NAMES = new Set([
  'body',
  'subject',
  'message',
  'text',
  'content',
  'summary',
  'html',
  'markdown',
  'note',
  'notes',
  'query',
  'prompt',
  'title',
]);

const EXACT_EMAIL_PARAMETERS = new Set([
  'to',
  'recipient',
  'recipients',
  'email',
  'address',
  'cc',
  'bcc',
  'phone',
]);

const NAME_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'this',
  'that',
  'me',
  'our',
  'your',
  'summary',
  'document',
  'doc',
  'report',
  'please',
  'about',
  'it',
  'them',
  'him',
  'her',
  'someone',
  'team',
  'all',
  'everyone',
  'list',
  'ticket',
  'file',
  'message',
  'mail',
  'email',
  'and',
  'for',
  'with',
  'from',
  'of',
  'on',
  'in',
  'at',
  'by',
]);

const PRIMARY_EMAIL_PARAMETER_ORDER = [
  'to',
  'recipient',
  'recipients',
  'send_to',
  'mailto',
  'mail_to',
  'email_to',
  'recipient_email',
  'email',
  'address',
  'phone',
] as const;

export interface ObservedToolExchange {
  readonly toolName: string;
  readonly argumentsText: string;
  readonly outputText: string;
}

export type DestinationOrigin =
  | { readonly kind: 'lookup'; readonly matchedName: string }
  | { readonly kind: 'content' }
  | { readonly kind: 'unknown' };

function tokensOf(toolName: string): readonly string[] {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token !== '');
}

/** A contacts-style read, inferred from the tool name. Sending mail is not a lookup. */
export function isRecipientLookupTool(toolName: string): boolean {
  const tokens = tokensOf(toolName);
  if (
    tokens.includes('send') ||
    tokens.includes('post') ||
    tokens.includes('delete') ||
    tokens.includes('mail')
  ) {
    return false;
  }
  if (
    tokens.some(
      (token) =>
        token === 'contact' ||
        token === 'contacts' ||
        token === 'addressbook' ||
        token === 'directory',
    )
  ) {
    return true;
  }
  const hasVerb = tokens.some((token) => LOOKUP_VERBS.has(token));
  const hasNoun = tokens.some((token) => LOOKUP_NOUNS.has(token));
  return hasVerb && hasNoun;
}

function normalizedParameter(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A field that chooses an email recipient.
 *
 * Names are matched first. A description can add a field the name did not reveal
 * (`who` described as the recipient). It cannot turn `body` or `subject` into a
 * destination, because those fields are meant to carry document text.
 */
export function isEmailAuthorityParameter(name: string, description = ''): boolean {
  const raw = name.toLowerCase();
  const key = normalizedParameter(name);
  if (CONTENT_PARAMETER_NAMES.has(raw) || CONTENT_PARAMETER_NAMES.has(key)) {
    return false;
  }
  if (EXACT_EMAIL_PARAMETERS.has(raw)) {
    return true;
  }
  if (/(^|_)(cc|bcc|recipient|recipients|email|address|phone)$/.test(raw)) {
    return true;
  }
  if (/(^|_)to$/.test(raw)) {
    return true;
  }
  if (/^(sendto|mailto|emailto|recipientemail|phonenumber)$/.test(key)) {
    return true;
  }
  return /\b(recipient|e-?mail address|carbon copy|blind carbon|send to|destination address)\b/i.test(
    description,
  );
}

export function isCopyParameter(name: string, kind: 'cc' | 'bcc'): boolean {
  const raw = name.toLowerCase();
  return raw === kind || raw.endsWith(`_${kind}`) || raw.startsWith(`${kind}_`);
}

export function primaryEmailParameter(
  parameters: readonly string[],
): string | undefined {
  const candidates = parameters.filter(
    (parameter) =>
      isEmailAuthorityParameter(parameter) &&
      !isCopyParameter(parameter, 'cc') &&
      !isCopyParameter(parameter, 'bcc'),
  );
  for (const preferred of PRIMARY_EMAIL_PARAMETER_ORDER) {
    const found = candidates.find((parameter) => parameter.toLowerCase() === preferred);
    if (found !== undefined) {
      return found;
    }
  }
  return candidates[0];
}

export function copyParameter(
  parameters: readonly string[],
  kind: 'cc' | 'bcc',
): string | undefined {
  return parameters.find((parameter) => isCopyParameter(parameter, kind));
}

function acceptName(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const token = raw.trim();
  if (token.length < 2 || token.includes('@')) {
    return undefined;
  }
  if (NAME_STOPWORDS.has(token.toLowerCase())) {
    return undefined;
  }
  return token;
}

function nameFromMatch(
  userRequest: string,
  match: RegExpMatchArray | null,
): string | undefined {
  if (match === null || match.index === undefined) {
    return undefined;
  }
  const end = match.index + match[0].length;
  if (userRequest[end] === '@') {
    return undefined;
  }
  const first = acceptName(match[1]);
  if (first === undefined) {
    return undefined;
  }
  const secondRaw = match[2];
  if (secondRaw !== undefined && /^[A-Z]/.test(secondRaw)) {
    const second = acceptName(secondRaw);
    if (second !== undefined) {
      return `${first} ${second}`;
    }
  }
  return first;
}

const TO_NAME_PATTERN =
  /\bto\s+([A-Za-z][A-Za-z'-]{1,40})(?:\s+([A-Za-z][A-Za-z'-]{1,40}))?/;
const EMAIL_NAME_PATTERN =
  /\b(?:e-?mail|mail)\s+([A-Za-z][A-Za-z'-]{1,40})(?:\s+([A-Za-z][A-Za-z'-]{1,40}))?/i;

/** Person the user named as the main recipient, when they did not type an address. */
export function primaryPartyName(userRequest: string): string | undefined {
  const directed = nameFromMatch(userRequest, userRequest.match(TO_NAME_PATTERN));
  if (directed !== undefined) {
    return directed;
  }
  return nameFromMatch(userRequest, userRequest.match(EMAIL_NAME_PATTERN));
}

function labeledEmail(userRequest: string, label: 'cc' | 'bcc'): string | undefined {
  const match = userRequest.match(
    new RegExp(
      `\\b${label}\\b\\s*(?::|to)?\\s*([\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,})`,
      'i',
    ),
  );
  return match?.[1];
}

export function labeledPartyName(
  userRequest: string,
  label: 'cc' | 'bcc',
): string | undefined {
  if (labeledEmail(userRequest, label) !== undefined) {
    return undefined;
  }
  const match = userRequest.match(
    new RegExp(`\\b${label}\\b\\s+(?:to\\s+)?([A-Za-z][A-Za-z'-]{1,40})`, 'i'),
  );
  return acceptName(match?.[1]);
}

const ALL_EMAILS = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;

/** First address in the request that was not introduced as cc or bcc. */
export function primaryEmail(userRequest: string): string | undefined {
  const reserved = new Set(
    [labeledEmail(userRequest, 'cc'), labeledEmail(userRequest, 'bcc')]
      .filter((email): email is string => email !== undefined)
      .map((email) => email.toLowerCase()),
  );
  const emails = userRequest.match(ALL_EMAILS) ?? [];
  return emails.find((email) => !reserved.has(email.toLowerCase()));
}

export function labeledRecipientEmail(
  userRequest: string,
  label: 'cc' | 'bcc',
): string | undefined {
  return labeledEmail(userRequest, label);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionsName(haystack: string, name: string): boolean {
  const parts = name.split(/\s+/).filter((part) => part !== '');
  if (parts.length === 0) {
    return false;
  }
  return parts.every((part) =>
    new RegExp(`\\b${escapeRegExp(part)}\\b`, 'i').test(haystack),
  );
}

function includesNeedle(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function needlesOf(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    const found = value.match(EMAIL_PATTERN);
    if (found !== null && found.length > 0) {
      return found;
    }
    const trimmed = value.trim();
    return trimmed === '' ? [] : [trimmed];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => needlesOf(entry));
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  return [];
}

function authorizedLookupName(
  observation: ObservedToolExchange,
  names: readonly string[],
  needle: string,
): string | undefined {
  if (!isRecipientLookupTool(observation.toolName)) {
    return undefined;
  }
  if (!includesNeedle(observation.outputText, needle)) {
    return undefined;
  }
  return names.find((name) => {
    if (mentionsName(observation.argumentsText, name)) {
      return true;
    }
    return (
      observation.outputText.length <= SHORT_LOOKUP_RECORD_CHARS &&
      mentionsName(observation.outputText, name)
    );
  });
}

function originOfValue(
  value: unknown,
  names: readonly string[],
  observations: readonly ObservedToolExchange[],
): DestinationOrigin {
  const needles = needlesOf(value);
  if (needles.length === 0) {
    return { kind: 'unknown' };
  }

  let matchedName: string | undefined;
  for (const needle of needles) {
    let lookupName: string | undefined;
    for (const observation of observations) {
      const name = authorizedLookupName(observation, names, needle);
      if (name !== undefined) {
        lookupName = name;
        break;
      }
    }
    if (lookupName !== undefined) {
      matchedName = lookupName;
      continue;
    }
    const seenInContent = observations.some((observation) =>
      includesNeedle(observation.outputText, needle),
    );
    if (seenInContent) {
      return { kind: 'content' };
    }
    return { kind: 'unknown' };
  }

  if (matchedName === undefined) {
    return { kind: 'unknown' };
  }
  return { kind: 'lookup', matchedName };
}

export function destinationOriginsForCall(input: {
  readonly authorityParameters: readonly string[];
  readonly args: Readonly<Record<string, unknown>>;
  readonly namedParties: Readonly<Record<string, readonly string[]>>;
  readonly observations: readonly ObservedToolExchange[];
}): Readonly<Record<string, DestinationOrigin>> {
  const origins: Record<string, DestinationOrigin> = {};
  for (const parameter of input.authorityParameters) {
    if (!isEmailAuthorityParameter(parameter)) {
      continue;
    }
    if (!(parameter in input.args)) {
      continue;
    }
    origins[parameter] = originOfValue(
      input.args[parameter],
      input.namedParties[parameter] ?? [],
      input.observations,
    );
  }
  return origins;
}
