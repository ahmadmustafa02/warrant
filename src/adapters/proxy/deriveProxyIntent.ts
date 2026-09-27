import {
  copyParameter,
  labeledPartyName,
  labeledRecipientEmail,
  primaryEmail,
  primaryEmailParameter,
  primaryPartyName,
} from '@/core/authorization/recipientOrigin';
import type { UserIntent } from '@/core/authorization/warrant';
import type { ToolRegistry } from '@/core/tools/registry';
import { tokenizeToolName } from './classifyDiscoveredTool';

/**
 * Which observed tools this turn authorized, inferred from the user's own words.
 *
 * Read-only tools are omitted deliberately: the guard exempts them by risk tier, so
 * listing them would add nothing and any miss here would obstruct ordinary work.
 * Only consequential tools need a grant, and those are exactly the ones a user
 * tends to name ("email this to Bob", "refund the charge").
 *
 * This is a heuristic for the zero-config path. Integrators who need precision use
 * `issueWarrantFromExplicit`, where the application states grants outright.
 */

/** Tokens too generic to carry authorization signal on their own. */
const IGNORED_TOKENS = new Set([
  'api',
  'tool',
  'data',
  'item',
  'items',
  'the',
  'and',
  'for',
  'with',
  'new',
  'old',
  'v1',
  'v2',
]);

const SYNONYMS: readonly (readonly string[])[] = [
  ['send', 'email', 'mail', 'deliver', 'dispatch', 'forward', 'notify', 'message'],
  ['email', 'mail', 'inbox', 'message'],
  ['delete', 'remove', 'drop', 'erase', 'purge', 'clear'],
  ['refund', 'reimburse', 'repay', 'credit'],
  ['transfer', 'wire', 'move', 'pay', 'send'],
  ['charge', 'bill', 'payment', 'pay'],
  ['file', 'document', 'doc', 'attachment'],
  ['ticket', 'issue', 'case'],
  ['user', 'account', 'member', 'customer'],
  ['comment', 'reply', 'note'],
  ['deploy', 'release', 'ship', 'publish'],
  ['create', 'add', 'make', 'open', 'new'],
  ['update', 'edit', 'change', 'modify', 'patch'],
  ['fetch', 'download', 'browse', 'visit', 'open', 'read'],
];

function expandToken(token: string): readonly string[] {
  const expanded = new Set<string>([token]);
  for (const group of SYNONYMS) {
    if (group.includes(token)) {
      for (const word of group) {
        expanded.add(word);
      }
    }
  }
  return [...expanded];
}

/** Word-boundary match so "mail" does not satisfy "email" by substring alone. */
function mentions(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

function userNamedTool(userRequest: string, toolName: string): boolean {
  const text = userRequest.toLowerCase();
  const flattened = text.replace(/[^a-z0-9]+/g, '');
  if (flattened.includes(toolName.toLowerCase().replace(/[^a-z0-9]+/g, ''))) {
    return true;
  }

  const tokens = tokenizeToolName(toolName).filter(
    (token) => token.length >= 3 && !IGNORED_TOKENS.has(token),
  );
  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) =>
    expandToken(token).some((word) => mentions(text, word)),
  );
}

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/i;
const PATH_PATTERN = /\b[\w.-]*\/[\w./-]+\b/;
const AMOUNT_PATTERN = /(?:\$|\bamount\s+(?:of\s+)?)(\d+(?:\.\d+)?)/i;

const URL_PARAMETERS = new Set(['url', 'uri', 'endpoint', 'host', 'hostname']);
const PATH_PARAMETERS = new Set(['path', 'filepath', 'destination', 'dest']);

interface RecipientBinding {
  readonly pins: Record<string, string>;
  readonly parties: Record<string, readonly string[]>;
}

/**
 * Binds each destination field to what the user actually said.
 *
 * A typed address locks that field. "cc" and "bcc" lock their own fields, not
 * `to`. A person's name, with no address, is recorded so a later lookup of that
 * person can fill the field. One address is not copied onto every email field:
 * a tool that also has `recipient` must not require the call to repeat `to`.
 */
function bindRecipients(
  userRequest: string,
  authorityParameters: readonly string[],
): RecipientBinding {
  const pins: Record<string, string> = {};
  const parties: Record<string, string[]> = {};

  const primary = primaryEmailParameter(authorityParameters);
  const cc = copyParameter(authorityParameters, 'cc');
  const bcc = copyParameter(authorityParameters, 'bcc');
  const email = primaryEmail(userRequest);
  const ccEmail = labeledRecipientEmail(userRequest, 'cc');
  const bccEmail = labeledRecipientEmail(userRequest, 'bcc');

  if (primary !== undefined && email !== undefined) {
    pins[primary] = email;
  } else if (primary !== undefined) {
    const name = primaryPartyName(userRequest);
    if (name !== undefined) {
      parties[primary] = [name];
    }
  }
  if (cc !== undefined && ccEmail !== undefined) {
    pins[cc] = ccEmail;
  } else if (cc !== undefined) {
    const name = labeledPartyName(userRequest, 'cc');
    if (name !== undefined) {
      parties[cc] = [name];
    }
  }
  if (bcc !== undefined && bccEmail !== undefined) {
    pins[bcc] = bccEmail;
  } else if (bcc !== undefined) {
    const name = labeledPartyName(userRequest, 'bcc');
    if (name !== undefined) {
      parties[bcc] = [name];
    }
  }

  const url = userRequest.match(URL_PATTERN)?.[0];
  const path = userRequest.match(PATH_PATTERN)?.[0];
  const amount = userRequest.match(AMOUNT_PATTERN)?.[1];
  for (const parameter of authorityParameters) {
    const key = parameter.toLowerCase();
    if (url !== undefined && URL_PARAMETERS.has(key)) {
      pins[parameter] = url;
    }
    if (
      path !== undefined &&
      PATH_PARAMETERS.has(key) &&
      pins[parameter] === undefined
    ) {
      pins[parameter] = path;
    }
    if (amount !== undefined && key === 'amount') {
      pins[parameter] = amount;
    }
  }

  return { pins, parties };
}

/** Document id the user fixed in plain language (e.g. "summarize doc-1"). */
function documentScopeFromRequest(userRequest: string): string | undefined {
  return userRequest.match(/\b(doc-\d+)\b/i)?.[1];
}

export function deriveProxyIntent(
  userRequest: string,
  registry: ToolRegistry,
): UserIntent {
  const requestedTools: string[] = [];
  const pinnedParameters: Record<string, Record<string, string>> = {};
  const namedParties: Record<string, Record<string, readonly string[]>> = {};

  for (const tool of registry.list()) {
    if (!registry.requiresWarrant(tool.name)) {
      continue;
    }
    if (!userNamedTool(userRequest, tool.name)) {
      continue;
    }

    requestedTools.push(tool.name);
    const binding = bindRecipients(userRequest, tool.authorityParameters ?? []);
    if (Object.keys(binding.pins).length > 0) {
      pinnedParameters[tool.name] = binding.pins;
    }
    if (Object.keys(binding.parties).length > 0) {
      namedParties[tool.name] = binding.parties;
    }
  }

  // Read-only tools stay off the grant list unless the user narrowed scope. Without
  // this, "summarize doc-1" would not pin `id` under the proxy heuristic and doc-2
  // reads from injected content would pass the tier exemption.
  const scopedDocumentId = documentScopeFromRequest(userRequest);
  if (scopedDocumentId !== undefined && registry.has('read_document')) {
    if (!requestedTools.includes('read_document')) {
      requestedTools.push('read_document');
    }
    pinnedParameters['read_document'] = {
      id: scopedDocumentId,
      ...(pinnedParameters['read_document'] ?? {}),
    };
  }

  return {
    requestedTools,
    ...(Object.keys(pinnedParameters).length > 0 ? { pinnedParameters } : {}),
    ...(Object.keys(namedParties).length > 0 ? { namedParties } : {}),
  };
}
