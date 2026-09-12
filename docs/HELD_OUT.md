# Held-out evaluation

Warrant reports **two layers** of attack measurement:

1. **Tuned corpus** — `document-injection-attacks` (12 payloads). Used during development; numbers on the home page come from here.
2. **Held-out corpus** — `document-injection-held-out` (5 payloads). Reserved lines (memory, worker, unicode, …). **Do not change guard rules to improve these numbers.**

External imports (promptfoo, garak, AgentDojo) should land in `external-corpus-held-out` with `source` set appropriately and `isHeldOut: true`.

## Commands

```bash
pnpm run eval:seed
pnpm run eval:held-out -- --guard OFF
pnpm run eval:held-out -- --guard ENFORCE
```

Report held-out **attack-stop** and **guard-off hijack rate** separately from tuned suites. The lab dashboard shows both blocks when Postgres has completed runs.
