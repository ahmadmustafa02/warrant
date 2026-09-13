# @warrant/cli

Command-line interface for [Warrant](https://github.com/ahmadmustafa02/warrant) — provenance-based tool authorization on agent model traffic.

## Install

```bash
npm install -g @warrant/cli
```

Set **`GROQ_API_KEY`** (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) in your environment. Postgres is **not** required for the CLI.

## Quick start

```bash
warrant init --from-sandbox
warrant doctor
warrant red-team --limit 3          # guard OFF, then ENFORCE (local proxy + demo agent)
warrant guard -- node my-agent.js   # wrap your agent; model traffic goes through the proxy
```

## Commands

| Command | Purpose |
| ------- | ------- |
| `init` | Write `.warrant/proxy-policy.json` |
| `doctor` | Keys, policy, registry sanity |
| `red-team` | Run authored injections through the **proxy** (product path) |
| `guard` | Start proxy and run your command with `OPENAI_BASE_URL` (and Anthropic/Gemini bases) pointed at it |
| `attack` | Single payload in the **in-repo sandbox harness** (eval-style, one guard mode) |
| `eval intent` | Compare heuristic vs LLM intent on fixtures |

Custom agent under red-team:

```bash
warrant red-team --limit 1 -- -- node my-openai-agent.js
```

Your agent must read `OPENAI_BASE_URL` from the environment (OpenAI SDK-compatible clients work out of the box).

## Build from monorepo

```bash
pnpm --filter @warrant/cli build
node packages/cli/dist/warrant.js doctor
```

See the [root README](https://github.com/ahmadmustafa02/warrant#cli-warrant) for policy keys, streaming, and approval behavior.
