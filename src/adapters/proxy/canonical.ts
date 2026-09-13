/**
 * One shape the guard understands, regardless of which provider protocol carried it.
 *
 * Wire adapters (OpenAI today, Anthropic Messages later) translate into these types
 * and nothing else, so adding a protocol never touches authorization logic.
 */

/** A tool the agent advertised to its model, learned by observation rather than config. */
export interface DiscoveredTool {
  readonly name: string;
  readonly description: string;
  /** Parameter names from the advertised JSON schema, used to locate authority params. */
  readonly parameterNames: readonly string[];
}

/** What the agent asked its model to do, extracted from an outbound request. */
export interface CanonicalRequest {
  readonly model: string;
  /**
   * The turn the guard treats as authoritative.
   *
   * This is the latest `user` message, because tool output arrives under `tool` or
   * `assistant` roles. A framework that folds tool output into a `user` message
   * would hand authority to untrusted content — that limitation is why the explicit
   * `issueWarrantFromExplicit` API remains the precise integration path.
   */
  readonly userRequest: string;
  readonly tools: readonly DiscoveredTool[];
}

/** A tool call the model proposed in an inbound response. */
export interface CanonicalToolCall {
  /** Provider-assigned id, used to correlate a denial back to the right call. */
  readonly id: string;
  readonly name: string;
  /** Unparsed JSON, kept verbatim so the guard sees exactly what the tool would. */
  readonly rawArguments: string;
}
