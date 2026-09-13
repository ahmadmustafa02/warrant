/** Split `GROQ_API_KEY` when several org keys are listed comma-separated in `.env`. */
export function parseGroqApiKeys(raw: string): readonly string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function isGroqKeyRotationError(message: string): boolean {
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('429') ||
    /rate limit/i.test(message) ||
    /invalid api key/i.test(message)
  );
}
