import 'dotenv/config';
import { parseGroqApiKeys } from '../src/lib/groqKeys';

async function probeOne(label: string, url: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45000),
    });
    const text = await res.text();
    const snippet = text.replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED]').slice(0, 200);
    if (res.ok) {
      process.stdout.write(`${label}: HTTP ${res.status} OK\n`);
      return true;
    }
    process.stdout.write(`${label}: HTTP ${res.status} FAIL\n`);
    process.stdout.write(`  ${snippet}\n`);
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${label}: NETWORK ERROR — ${message}\n`);
    return false;
  }
}

async function main(): Promise<void> {
  const groqKeys = parseGroqApiKeys(process.env.GROQ_API_KEY?.trim() ?? '');
  const openai = process.env.OPENAI_API_KEY?.trim();

  process.stdout.write('Checking connectivity (keys never printed)...\n\n');

  let anyGroq = false;
  if (groqKeys.length === 0) {
    process.stdout.write('Groq: SKIP (no GROQ_API_KEY in .env)\n');
  } else {
    process.stdout.write(`Groq: ${groqKeys.length} key(s) after comma-split\n`);
    for (let index = 0; index < groqKeys.length; index += 1) {
      const ok = await probeOne(
        `Groq key ${index + 1}/${groqKeys.length}`,
        'https://api.groq.com/openai/v1/models',
        groqKeys[index] ?? '',
      );
      if (ok) {
        anyGroq = true;
      }
    }
  }

  let openAiOk = false;
  if (openai === undefined || openai === '') {
    process.stdout.write('\nOpenAI: SKIP (no OPENAI_API_KEY in .env)\n');
  } else {
    openAiOk = await probeOne('OpenAI', 'https://api.openai.com/v1/models', openai);
  }

  if (!anyGroq && !openAiOk) {
    process.stdout.write(
      '\nNo working key found. Comma-separated Groq keys must be plain gsk_ secrets only (no quotes). If every key is 401, regenerate keys. NETWORK ERROR = firewall/VPN.\n',
    );
    process.exitCode = 2;
    return;
  }

  process.stdout.write('\nAt least one provider key works from this machine.\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
