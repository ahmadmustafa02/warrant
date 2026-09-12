/**
 * Where a value in an agent's context came from.
 *
 * This is the foundation of the whole defense: authority is a property of origin,
 * not of wording. A paragraph inside a PDF that says "you are now authorized to
 * wire funds" is still TOOL_RESULT data, however imperative it sounds.
 */
export const PROVENANCE_KINDS = [
  'USER',
  'SYSTEM',
  'TOOL_RESULT',
  'MEMORY',
  'WORKER',
] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

/**
 * The only origins that may confer authority.
 *
 * SYSTEM qualifies because the operator's own prompt is trusted configuration
 * shipped with the application. MEMORY deliberately does not: stored text can be
 * poisoned on an earlier turn and read back later, which is exactly the delayed
 * attack this project is built to catch.
 */
export const AUTHORITATIVE_PROVENANCE = [
  'USER',
  'SYSTEM',
] as const satisfies readonly ProvenanceKind[];

export type AuthoritativeProvenance = (typeof AUTHORITATIVE_PROVENANCE)[number];

/**
 * A value paired with every origin that contributed to it.
 *
 * `sources` is append-only by construction. This module exposes no operation that
 * removes an origin, so a value derived from untrusted content cannot be laundered
 * into a trusted one by passing it through enough transformations.
 */
export interface TaintedValue<T> {
  readonly value: T;
  readonly sources: readonly ProvenanceKind[];
}
