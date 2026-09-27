function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface SchemaParameters {
  readonly names: readonly string[];
  readonly descriptions: Readonly<Record<string, string>>;
}

/** Parameter names and descriptions from a JSON-schema object, or empty if malformed. */
export function readSchemaParameters(parameters: unknown): SchemaParameters {
  if (!isRecord(parameters) || !isRecord(parameters.properties)) {
    return { names: [], descriptions: {} };
  }

  const names: string[] = [];
  const descriptions: Record<string, string> = {};
  for (const [name, schema] of Object.entries(parameters.properties)) {
    names.push(name);
    if (!isRecord(schema)) {
      continue;
    }
    if (typeof schema.description === 'string' && schema.description !== '') {
      descriptions[name] = schema.description;
    }
  }

  return {
    names: Object.freeze(names),
    descriptions: Object.freeze(descriptions),
  };
}
