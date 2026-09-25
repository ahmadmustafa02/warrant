import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

function describe(name: string, value: string | undefined): void {
  if (value === undefined || value === '') {
    process.stdout.write(`${name}: empty or unset after dotenv load\n`);
    return;
  }
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  const hasWhitespace = /\s/.test(value);
  process.stdout.write(
    `${name}: ${value.length} chars, starts with "${value.slice(0, 4)}", ends with "${value.slice(-3)}"\n`,
  );
  process.stdout.write(
    `  quoted wrapper: ${quoted}, internal whitespace: ${hasWhitespace}\n`,
  );
  if (name === 'GROQ_API_KEY' && !value.startsWith('gsk_')) {
    process.stdout.write('  WARN: Groq keys usually start with gsk_\n');
  }
  if (name === 'OPENAI_API_KEY' && !value.startsWith('sk-')) {
    process.stdout.write('  WARN: OpenAI keys usually start with sk-\n');
  }
}

const envPath = path.join(process.cwd(), '.env');
process.stdout.write(`.env path: ${envPath}\n`);
process.stdout.write(`.env exists: ${fs.existsSync(envPath)}\n\n`);

describe('GROQ_API_KEY', process.env.GROQ_API_KEY?.trim());
describe('OPENAI_API_KEY', process.env.OPENAI_API_KEY?.trim());

const raw = fs.readFileSync(envPath, 'utf8');
for (const varName of ['GROQ_API_KEY', 'OPENAI_API_KEY'] as const) {
  const line = raw.split(/\r?\n/).find((entry) => entry.startsWith(`${varName}=`));
  if (line === undefined) {
    process.stdout.write(`\n${varName} line: missing in .env file\n`);
    continue;
  }
  const valuePart = line.slice(varName.length + 1).trim();
  process.stdout.write(
    `\n${varName} line present, value length in file: ${valuePart.length}\n`,
  );
  if (/^['"]/.test(valuePart)) {
    process.stdout.write(`  WARN: remove quotes around the key in .env\n`);
  }
}
