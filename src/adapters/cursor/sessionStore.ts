import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Warrant } from '@/core/authorization/warrant';

export type CursorLedgerEvent =
  | { readonly type: 'warrant'; readonly at: string; readonly warrant: Warrant }
  | { readonly type: 'read'; readonly at: string; readonly path: string }
  | {
      readonly type: 'shadow';
      readonly at: string;
      readonly hook: string;
      readonly code: string;
      readonly reason: string;
      readonly detail: Record<string, unknown>;
    };

export function warrantSessionRoot(): string {
  const override = process.env.WARRANT_SESSION_ROOT;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return path.join(os.homedir(), '.cursor', 'warrant', 'sessions');
}

export function sessionLedgerPath(sessionId: string): string {
  const safe = sessionId.replace(/[^\w.-]+/g, '_').slice(0, 128);
  return path.join(warrantSessionRoot(), `${safe}.jsonl`);
}

export function appendLedgerEvent(sessionId: string, event: CursorLedgerEvent): void {
  const filePath = sessionLedgerPath(sessionId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

export function readLedgerEvents(sessionId: string): CursorLedgerEvent[] {
  const filePath = sessionLedgerPath(sessionId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const events: CursorLedgerEvent[] = [];
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
        events.push(parsed as CursorLedgerEvent);
      }
    } catch {
      continue;
    }
  }
  return events;
}

export function latestWarrant(sessionId: string): Warrant | undefined {
  const events = readLedgerEvents(sessionId);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === 'warrant') {
      return event.warrant;
    }
  }
  return undefined;
}
