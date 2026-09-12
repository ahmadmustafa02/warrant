import {
  AUTHORITATIVE_PROVENANCE,
  PROVENANCE_KINDS,
  type ProvenanceKind,
  type TaintedValue,
} from './types';

const KIND_ORDER = new Map<ProvenanceKind, number>(
  PROVENANCE_KINDS.map((kind, index) => [kind, index]),
);

/** Sorted and deduplicated so two equivalent taint sets compare and log identically. */
function normalizeSources(
  sources: Iterable<ProvenanceKind>,
): readonly ProvenanceKind[] {
  const unique = [...new Set(sources)];
  unique.sort((a, b) => (KIND_ORDER.get(a) ?? 0) - (KIND_ORDER.get(b) ?? 0));
  return Object.freeze(unique);
}

export class ProvenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceError';
  }
}

/**
 * Tags a value with its origin. At least one source is mandatory: an untagged
 * value would be indistinguishable from a trusted one, so the type system is not
 * given the option.
 */
export function taint<T>(
  value: T,
  ...sources: readonly ProvenanceKind[]
): TaintedValue<T> {
  if (sources.length === 0) {
    throw new ProvenanceError(
      'a tainted value requires at least one provenance source; untagged values are not permitted',
    );
  }
  return Object.freeze({ value, sources: normalizeSources(sources) });
}

export function isAuthoritative(kind: ProvenanceKind): boolean {
  return (AUTHORITATIVE_PROVENANCE as readonly ProvenanceKind[]).includes(kind);
}

/**
 * True only when *every* contributing origin may confer authority.
 *
 * The quantifier is the point. A value assembled from the user's request and a
 * fetched web page is not trusted, because an attacker controls part of it.
 */
export function isTrusted(value: TaintedValue<unknown>): boolean {
  return value.sources.every(isAuthoritative);
}

export function isUntrusted(value: TaintedValue<unknown>): boolean {
  return !isTrusted(value);
}

/** Transforms the payload while carrying provenance across the derivation. */
export function mapTainted<T, U>(
  source: TaintedValue<T>,
  transform: (value: T) => U,
): TaintedValue<U> {
  return Object.freeze({ value: transform(source.value), sources: source.sources });
}

export function sourcesOf(
  values: readonly TaintedValue<unknown>[],
): readonly ProvenanceKind[] {
  return normalizeSources(values.flatMap((entry) => entry.sources));
}

export function sourcesOfArguments(
  args: Readonly<Record<string, TaintedValue<unknown>>>,
): readonly ProvenanceKind[] {
  return sourcesOf(Object.values(args));
}

/** Renders an unknown payload for log and denial messages without throwing. */
export function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Tagged template that propagates taint through string composition.
 *
 * String concatenation is the most common laundering path in an agent — a prompt
 * is built by interpolating a document into a template, and the result looks like
 * an ordinary string. Building it here keeps the origins attached. The literal
 * segments count as SYSTEM because they are authored in the source code.
 */
export function taintedFormat(
  literals: TemplateStringsArray,
  ...substitutions: readonly TaintedValue<unknown>[]
): TaintedValue<string> {
  let rendered = literals[0] ?? '';
  for (const [index, substitution] of substitutions.entries()) {
    rendered += describeValue(substitution.value) + (literals[index + 1] ?? '');
  }
  return Object.freeze({
    value: rendered,
    sources: normalizeSources([
      'SYSTEM',
      ...substitutions.flatMap((entry) => entry.sources),
    ]),
  });
}
