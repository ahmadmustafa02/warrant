# Plan 02 — Guard decision log and viewer

Status: APPROVED 27 Sep 2026, ready to build. Roadmap item 2.

## Problem

The proxy already makes a full decision for every tool call a model proposes:
allowed or denied, the reason code, the risk tier, which provenance tainted the
arguments. `warrant guard` prints one line ("Blocked: send_email") and throws
the rest away. After a run there is no record of what the guard did or why, so
a user cannot audit it, and a scan result cannot be walked through afterwards.

The lab site does store decisions (`GuardDecision` in Postgres), but only for
its own eval runs. A CLI user has no database and should not need one.

## Decision (locked)

Decisions go to a **local append-only file**, `.warrant/decisions.ndjson`, one
JSON object per line. Viewed two ways: a new `warrant log` command, and a
`/decisions` page on the lab site that reads the same file when run locally.
Postgres is not involved.

## Record shape

Validated by a Zod schema on write and on read. Versioned so the format can
change later without breaking old files.

```ts
{
  v: 1,
  at: string,            // ISO timestamp
  sessionId: string,     // one per proxy start (one `warrant guard` / one scan probe)
  source: 'guard' | 'scan',
  mode: 'DETECT_ONLY' | 'ENFORCE',   // OFF never logs: nothing is decided
  tool: string,
  riskTier?: 'READ_ONLY' | 'SENSITIVE' | 'DESTRUCTIVE',
  verdict: 'allowed' | 'denied' | 'would-deny',
  kind: 'GUARD' | 'MALFORMED' | 'DRIFT',
  code?: DenialCode,     // present when denied / would-deny by the guard
  authorizedBy?: 'USER_WARRANT' | 'RISK_TIER',
  taintSources: ProvenanceKind[],
  reason: string,        // truncated to 300 chars
}
```

`would-deny` is a DETECT_ONLY denial: the guard judged it, but let it through.
Keeping it distinct from `denied` means the log never claims something was
stopped when it was not.

**Never stored:** tool arguments, model messages, prompts, API keys, headers.
During a scan the canary string is replaced with `[canary]` in `reason` before
writing, so the log never holds the planted credential.

## Where the code goes

- `src/adapters/proxy/decisionRecord.ts` — Zod schema + pure
  `toDecisionRecords(decisions, context)` mapping `ProxyDecision[]` to records.
  No filesystem. Covered by the existing coverage gate.
- `src/cli/decisionLog/fileSink.ts` — appends lines. Uses synchronous append:
  volume is a few lines per model call, it keeps order, and there is no promise
  to drop. Rotates to `decisions.1.ndjson` past 5 MB (one old file kept).
- `src/cli/decisionLog/readDecisionLog.ts` — reads and validates. The file is
  untrusted input: a bad line is skipped and counted, never trusted.
- `proxyServer.ts` — `onExchange` also passes `decisions`. The proxy itself does
  not write files; the CLI owns the sink.
- `guard.ts`, `runScanProbe.ts` — create a session id and attach the sink
  (`source: 'guard'` / `'scan'`).
- `src/cli/commands/log.ts` — `warrant log`.
- `src/app/decisions/page.tsx` + a server-only reader wrapper — local viewer.

`src/core/` is untouched.

## Failure rule

A failed log write never breaks the guard, in any mode. Enforcement happens
before logging and does not depend on it. The first failure prints one warning;
later failures are silent for that run. The log is a record, not a control.

## `warrant log`

```
warrant log [--denied] [--include-scan] [--session ID] [--limit N] [--json]
```

- Default: last 50 decisions from `guard` runs, newest first, grouped by session.
- `--denied` shows `denied` and `would-deny` only.
- Scan runs are hidden by default: a scan deliberately provokes denials, and
  mixing them in would make a normal agent look under attack.
- Each session header shows allowed and denied counts together.
- Reports how many lines were skipped as invalid, if any.

## `/decisions` page

Server component, local only. Reads the file from the working directory the
site was started in. Session list with allowed / denied / would-deny counts,
expandable to the decision rows (tool, tier, verdict, code, reason, time).
Missing file shows an empty state with `warrant guard -- <your agent>`. On the
hosted site the file does not exist, so it shows the same empty state. No
network, no database.

## Configuration

- `WARRANT_DECISION_LOG=<path>` overrides the location.
- `WARRANT_DECISION_LOG=off` disables writing.
- `.gitignore` gets `.warrant/decisions*.ndjson`.

## Tests

- Mapping: allowed, denied, would-deny, malformed, drift; `OFF` yields nothing;
  reason truncation; canary replaced.
- Sink: appends valid lines; rotation at the size limit; write error does not
  throw.
- Reader: skips and counts malformed and wrong-version lines; filters by
  source, verdict, session; newest first.
- Proxy E2E: a hijack run in ENFORCE writes one `allowed` (read) and one
  `denied` (send) line to a temp path.

## Build order

1. `decisionRecord.ts` + tests.
2. Sink + reader + tests.
3. Thread `decisions` through `onExchange`; attach sink in guard and scan.
4. `warrant log` + help text.
5. `/decisions` page.
6. Docs: README section, `docs/DECISION_LOG.md`, `.gitignore`.
7. Live check: `warrant guard` on `scripts/realistic-test-agent.ts` with the
   poisoned document, then `warrant log` shows the denied `send_email`.
8. Lint, typecheck, full tests. Commit and push.
