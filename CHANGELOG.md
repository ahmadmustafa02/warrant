# Changelog

All notable changes to this project are documented here.

## 0.3.1 — 2026-10-01

### Added

- `npm install -g @warrant-lab/cli --foreground-scripts` prints the Warrant banner and the next two commands. A plain install hides that script, because npm's default is to run install scripts in the background.

## 0.3.0 — 2026-10-01

### Fixed

- A tool result pasted back as a user message does not grant a tool. The warrant stays the last real user message. Scan plants into that same observation slot.

### Changed

- A harmless new tool (read-only name, no destination field, no secret) is allowed and saved. A risky new tool, or a known tool that gains a parameter, still waits for a person.

## 0.2.0 — 2026-09-29

### Added

- `warrant scan --adaptive` probes the tools an agent actually advertises and stops at the first shape it acts on.
- `warrant scan --full` runs every attack shape, repeated, and reports a stop rate per shape next to the benign-pass rate.
- `warrant scan --share` prints a URL. The page shows attack-stop and benign-pass together. The canary is not in the link.
- Guard: only the latest user message grants a tool. An email address must be typed by the user or returned by a lookup of the person they named. Unauthorized secrets are removed from replies and payloads. A new or changed tool stays blocked until someone approves it, and that list is saved in `.warrant/tool-pin.json`.
- `warrant guard --mcp` judges MCP `tools/call`. OpenAI Responses and Gemini are guarded. Decision log: `warrant log`.

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
