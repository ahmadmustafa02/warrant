import { z } from 'zod';
import type { CanonicalRequest, CanonicalToolCall, DiscoveredTool } from './canonical';
import { redactArgumentRecord } from './redactToolArguments';
import { readSchemaParameters } from './schemaParameters';

const partSchema = z.union([
  z.object({ text: z.string() }),
  z.object({
    functionCall: z.object({
      name: z.string().min(1),
      args: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({ functionResponse: z.object({ name: z.string(), response: z.unknown() }) }),
  z.object({}).passthrough(),
]);

const contentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(partSchema),
});

export const geminiGenerateRequestSchema = z.object({
  contents: z.array(contentSchema),
  tools: z
    .array(
      z.object({
        functionDeclarations: z.array(
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            parameters: z.unknown().optional(),
          }),
        ),
      }),
    )
    .optional(),
});

export const geminiGenerateResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: contentSchema.optional(),
      }),
    )
    .optional(),
});

export class GeminiWireParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiWireParseError';
  }
}

function turnText(parts: z.infer<typeof contentSchema>['parts']): string {
  return parts
    .filter(
      (part): part is { text: string } =>
        'text' in part && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n');
}

function turnCalledTool(parts: z.infer<typeof contentSchema>['parts']): boolean {
  return parts.some(
    (part) => 'functionCall' in part && part.functionCall !== undefined,
  );
}

function turnCarriesToolOutput(parts: z.infer<typeof contentSchema>['parts']): boolean {
  return parts.some(
    (part) => 'functionResponse' in part && part.functionResponse !== undefined,
  );
}

function userTextFromContents(
  contents: z.infer<typeof geminiGenerateRequestSchema>['contents'],
): string {
  let text = '';
  for (let index = 0; index < contents.length; index += 1) {
    const entry = contents[index];
    if (entry === undefined) {
      continue;
    }
    const role = entry.role ?? 'user';
    if (role !== 'user') {
      continue;
    }
    if (turnCarriesToolOutput(entry.parts)) {
      continue;
    }
    const previous = contents[index - 1];
    if (previous !== undefined && turnCalledTool(previous.parts)) {
      continue;
    }
    const turn = turnText(entry.parts);
    if (turn !== '') {
      text = turn;
    }
  }
  return text;
}

export function parseGeminiRequest(body: unknown): CanonicalRequest {
  const parsed = geminiGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new GeminiWireParseError('request is not a Gemini generateContent call');
  }

  const tools: DiscoveredTool[] = [];
  for (const toolGroup of parsed.data.tools ?? []) {
    for (const decl of toolGroup.functionDeclarations) {
      const schema = readSchemaParameters(decl.parameters);
      tools.push({
        name: decl.name,
        description: decl.description ?? '',
        parameterNames: schema.names,
        ...(Object.keys(schema.descriptions).length > 0
          ? { parameterDescriptions: schema.descriptions }
          : {}),
      });
    }
  }

  return {
    model: 'gemini',
    userRequest: userTextFromContents(parsed.data.contents),
    tools: Object.freeze(tools),
  };
}

const functionCallPartSchema = z.object({
  functionCall: z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).optional(),
  }),
});

export function parseGeminiToolCalls(body: unknown): readonly CanonicalToolCall[] {
  const parsed = geminiGenerateResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new GeminiWireParseError('response is not a Gemini generateContent result');
  }

  const candidate = parsed.data.candidates?.[0]?.content;
  if (candidate === undefined) {
    return [];
  }

  const calls: CanonicalToolCall[] = [];
  let index = 0;
  for (const part of candidate.parts) {
    const fn = functionCallPartSchema.safeParse(part);
    if (!fn.success) {
      continue;
    }
    const id = `gemini_call_${index}`;
    index += 1;
    calls.push({
      id,
      name: fn.data.functionCall.name,
      rawArguments: JSON.stringify(fn.data.functionCall.args ?? {}),
    });
  }
  return Object.freeze(calls);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripDeniedGeminiFunctionCalls(
  rawResponse: unknown,
  denialsByCallId: ReadonlyMap<string, string>,
): unknown {
  if (denialsByCallId.size === 0 || !isRecord(rawResponse)) {
    return rawResponse;
  }

  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.candidates)) {
    return rawResponse;
  }

  const firstCandidate: unknown = clone.candidates[0];
  if (!isRecord(firstCandidate)) {
    return rawResponse;
  }
  const content = firstCandidate.content;
  if (!isRecord(content)) {
    return rawResponse;
  }
  const partsRaw = content.parts;
  if (!Array.isArray(partsRaw)) {
    return rawResponse;
  }

  const reasons: string[] = [];
  let callIndex = 0;
  const kept: unknown[] = [];
  for (const part of partsRaw) {
    if (!isRecord(part) || !isRecord(part.functionCall)) {
      kept.push(part);
      continue;
    }
    const id = `gemini_call_${callIndex}`;
    callIndex += 1;
    const reason = denialsByCallId.get(id);
    if (reason === undefined) {
      kept.push(part);
      continue;
    }
    reasons.push(reason);
  }

  if (reasons.length > 0) {
    kept.push({ text: reasons.join(' ') });
  }
  content.parts = kept;

  return clone;
}

export function redactGeminiTextParts(
  rawResponse: unknown,
  redact: (text: string) => string,
): unknown {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse.candidates)) {
    return rawResponse;
  }

  const clone: unknown = structuredClone(rawResponse);
  if (!isRecord(clone) || !Array.isArray(clone.candidates)) {
    return rawResponse;
  }

  const firstCandidate: unknown = clone.candidates[0];
  if (!isRecord(firstCandidate)) {
    return rawResponse;
  }
  const content = firstCandidate.content;
  if (!isRecord(content)) {
    return rawResponse;
  }
  const partsRaw = content.parts;
  if (!Array.isArray(partsRaw)) {
    return rawResponse;
  }

  for (const part of partsRaw) {
    if (!isRecord(part)) {
      continue;
    }
    if (typeof part.text === 'string') {
      part.text = redact(part.text);
    }
    if (isRecord(part.functionCall)) {
      const redacted = redactArgumentRecord(part.functionCall.args, redact);
      if (redacted.changed) {
        part.functionCall.args = redacted.value;
      }
    }
  }

  return clone;
}
