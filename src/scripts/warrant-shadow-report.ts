import fs from 'node:fs';
import path from 'node:path';
import { warrantSessionRoot } from '@/adapters/cursor/sessionStore';

type ShadowLine = {
  type: string;
  hook?: string;
  code?: string;
  reason?: string;
  at?: string;
};

function summarizeFile(filePath: string): {
  file: string;
  warrants: number;
  reads: number;
  shadows: number;
  byHook: Record<string, number>;
} {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(Boolean);
  let warrants = 0;
  let reads = 0;
  let shadows = 0;
  const byHook: Record<string, number> = {};

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ShadowLine;
      if (event.type === 'warrant') {
        warrants += 1;
      }
      if (event.type === 'read') {
        reads += 1;
      }
      if (event.type === 'shadow') {
        shadows += 1;
        const hook = event.hook ?? 'unknown';
        byHook[hook] = (byHook[hook] ?? 0) + 1;
      }
    } catch {
      continue;
    }
  }

  return { file: path.basename(filePath), warrants, reads, shadows, byHook };
}

function main(): void {
  const root = warrantSessionRoot();
  if (!fs.existsSync(root)) {
    console.log(`No session ledger yet (${root}).`);
    return;
  }

  const files = fs.readdirSync(root).filter((name) => name.endsWith('.jsonl'));
  if (files.length === 0) {
    console.log(`No session files in ${root}`);
    return;
  }

  let totalShadow = 0;
  console.log(`Warrant shadow report — ${root}\n`);

  for (const name of files.sort()) {
    const summary = summarizeFile(path.join(root, name));
    totalShadow += summary.shadows;
    console.log(
      `${summary.file}: ${summary.shadows} would-block · ${summary.warrants} warrants · ${summary.reads} reads`,
    );
    for (const [hook, count] of Object.entries(summary.byHook)) {
      console.log(`  ${hook}: ${count}`);
    }
  }

  console.log(`\nTotal would-block events: ${totalShadow}`);
}

main();
