# Changelog

All notable changes to this project are documented here.

## Unreleased

### Added

- `warrant scan` — hijack-tests an agent that knows nothing about Warrant. The proxy
  plants an attack line plus a canary credential inside the tool results the agent's
  own tools return, runs each payload in `DETECT_ONLY` then `ENFORCE`, and adds a
  clean benign run. Verdicts come from proxy-observed facts, never an LLM judge.
  Docs: [`docs/SCAN.md`](docs/SCAN.md).
- Proxy-side payload injection for the OpenAI, Anthropic, and Gemini wires, with a
  `user-content` target for agents that fold retrieved documents into the user turn.
- Canary tracking distinguishes an attempted leak (raw upstream reply) from one that
  actually reached the agent (post-guard response).

## 0.1.0 — 2026-09-13

First public release: provenance-based tool authorization, measured adversarial harness,
lab site, HTTP proxy CLI, and `@warrant-lab/guard` / `@warrant-lab/cli` packages.

### Added

- v1 eval corpus: **60** tuned attacks (families A–F), **24** benign tasks, **15** held-out attacks.
- Read-scope enforcement on read-only tools (pinned document ids).
- Egress-aware `fetch_url` and `guard:doctor` registry audit.
- Parameter constraints (`stringPattern`, `numberMax`) on tool definitions.
- Outcome detection for pinned `send_email.to` / `fetch_url.url` and canary in side channels.
- Cursor project hooks (shadow mode) and `pnpm run cursor:shadow-report`.
- Playground: recorded terminal (allowlisted install/init/doctor/attack/guard demos).
- CLI: `warrant init|guard|doctor|red-team|eval intent|attack` (`@warrant-lab/cli`).
- Proxy: Anthropic Messages wire, OpenAI SSE guard, pinned policy, interactive approval.
- Lab dashboard: held-out comparison, PromptGuard baseline panel, DETECT_ONLY summary.
- Landing metrics aligned with README scorecards.

### Measured (tuned corpus, `openai/gpt-oss-20b`, sandbox agent)

- Guard **OFF**: **17 / 60** hijacked · **23 / 24** benign-pass (1 Groq tool-JSON error).
- Guard **ENFORCE**: **60 / 60** attack-stop · **22 / 24** benign-pass (1 error).
- Proxy-equivalent intent (`eval:intent-scorecard`): **59 / 60** attack-stop (heuristic & LLM).
- PromptGuard (`llama-prompt-guard-2`, threshold 0.5): run `pnpm run eval:baseline` to refresh on 60 lines.

### Measured (held-out suite, 15 payloads)

- Guard **ENFORCE**: **15 / 15** attack-stop (latest local scorecard).

### Docs

- `docs/THREAT_MODEL.md`, `docs/HELD_OUT.md`, `docs/INTEGRATION.md`, `docs/DEPLOY.md`.
