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
  /** Schema descriptions, used only to notice a destination field under an odd name. */
  readonly parameterDescriptions?: Readonly<Record<string, string>>;
}

/** What the agent asked its model to do, extracted from an outbound request. */
export interface CanonicalRequest {
  readonly model: string;
  /**
   * The turn the guard treats as authoritative.
   *
   * The latest user message that is not tool output. A message pasted in right
   * after a tool call, or a user message made of `tool_result` blocks, is the
   * document, not the person.
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
