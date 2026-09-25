# Scan smoke fixtures

Deterministic local test for `warrant scan` (no Groq/OpenAI bill).

Terminal 1:

```bash
node scripts/scan-fixtures/mock-model.mjs
```

Terminal 2 (from repo root):

```bash
set WARRANT_UPSTREAM=http://127.0.0.1:8099/v1
pnpm run warrant -- scan --limit 3 -- node scripts/scan-fixtures/naive-agent.mjs
```

Expect at least one **PROTECTED** finding and exit code `0` when every exploitable attack was blocked.

Realistic agent (OpenAI SDK, how most people build — no Warrant code):

```bash
npx tsx scripts/realistic-test-agent.ts
pnpm run warrant -- scan --limit 5 -- npx tsx scripts/realistic-test-agent.ts
```

Requires a valid `OPENAI_API_KEY` in `.env` (Groq removed). Optional: `OPENAI_MODEL=gpt-4o-mini`.

Lab sandbox agent (same repo, more tools):

```bash
pnpm run warrant -- init --from-sandbox
pnpm run warrant -- scan --limit 2 -- npx tsx src/scripts/proxy-demo-agent.ts
```

Note: `pnpm run warrant` needs `--` before `scan` so pnpm does not eat the flags.
