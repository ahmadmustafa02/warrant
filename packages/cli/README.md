# @warrant/cli

Command-line interface for [Warrant](https://github.com/ahmadmustafa02/warrant) — provenance-based tool authorization on agent model traffic.

## Install

```bash
npm install -g @warrant/cli
```

Configure **your agent the way you already do** (e.g. `GROQ_API_KEY` / `OPENAI_API_KEY` in the agent’s `.env`). Warrant runs that agent and routes model traffic through a local proxy. No Warrant-hosted models, no separate Warrant API key. Postgres is **not** required.

## Quick start

```bash
warrant init --from-sandbox
warrant guard -- node my-agent.js
```

Optional: `warrant doctor` (sanity check), `warrant red-team -- node my-agent.js` (attack corpus, OFF then ENFORCE — see [INTEGRATION.md](../docs/INTEGRATION.md)).

## Commands

| Command | Purpose |
| ------- | ------- |
| `init` | Write `.warrant/proxy-policy.json` |
| `guard` | Proxy + your command (`OPENAI_BASE_URL` → Warrant) |
| `red-team` | Scripted OFF/ENFORCE runs against **your** agent |
| `doctor` | Optional: keys visible, policy file, registry |
| `attack` / `eval intent` | Warrant lab development only |

## Build from monorepo

```bash
pnpm --filter @warrant/cli build
node packages/cli/dist/warrant.js doctor
```

See the [root README](https://github.com/ahmadmustafa02/warrant#cli-warrant) for policy keys, streaming, and approval behavior.
