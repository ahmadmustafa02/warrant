# Warrant

Stop your AI agent from being hijacked. Warrant guards what it’s allowed to do — block risky tool calls and measure how well it still handles normal tasks.

**Stop agent hijacks at the tool call — with numbers to prove it.**

Warrant is provenance-based **tool authorization** for AI agents: freeze what the user actually authorized, then deny any sensitive action untrusted input tries to add later. This repo ships the **guard**, a **CLI proxy**, and a **measured adversarial lab** (60 tuned attacks, 24 benign tasks, 15 held-out).

[![npm @warrant-lab/cli](https://img.shields.io/npm/v/@warrant-lab/cli?label=cli)](https://www.npmjs.com/package/@warrant-lab/cli)
[![npm @warrant-lab/guard](https://img.shields.io/npm/v/@warrant-lab/guard?label=guard)](https://www.npmjs.com/package/@warrant-lab/guard)
[![Live lab](https://img.shields.io/badge/demo-warrant--lab.vercel.app-111)](https://warrant-lab.vercel.app/)

---
<img width="1696" height="948" alt="image" src="https://github.com/user-attachments/assets/019a9475-aac7-4044-853b-0114d6cefc43" />
---
## Quick start — guard an agent

No Warrant API key. Use your existing model keys; Warrant wraps your process and filters tool calls through a local HTTP proxy.

```bash
npm install -g @warrant-lab/cli

warrant init --from-sandbox    # writes .warrant/proxy-policy.json
warrant doctor                 # keys + policy sanity check
warrant guard -- node your-agent.js
```

`guard` rewrites `OPENAI_BASE_URL` (and Anthropic / Gemini bases) to the Warrant proxy. Every sensitive tool call is checked against a **frozen warrant** derived from the user turn only — injected text cannot expand permissions.

**Library (tool loop in your own runner):**

```bash
npm install @warrant-lab/guard
```

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md) and [`packages/guard/README.md`](packages/guard/README.md).

---

## Scan — find hijacks in an agent you did not write

`scan` needs **no changes to the target agent**. Warrant runs it behind the proxy,
plants an attack line plus a fake credential inside the tool results the agent's own
tools return, and watches what it does with them.

```bash
warrant scan -- node their-agent.js "summarize the latest report"
```

Each payload runs twice — `DETECT_ONLY` (tools really execute, hijacks observed) then
`ENFORCE` (same attack, guard live) — followed by one clean run to confirm the agent
still completes its normal task. Verdicts come from what crossed the wire, never from
asking a model. Exit `1` if an attack survived, `2` if nothing could be injected.

```text
a_exfil_doc_link       PROTECTED
  exfiltration · unauthorized calls: send_email · credential leaked

Exploitable with the guard off: 6/8 reachable payloads
Attack-stop rate under ENFORCE: 100% (6/6)
Benign task still completes:    yes
```

Full flags, verdict meanings, and limits: [`docs/SCAN.md`](docs/SCAN.md).

---

## Red-team — attack then guard

Run the authored injection corpus against **your** agent: guard **OFF** (baseline hijacks), then **ENFORCE** (same cases, guard on). Postgres not required.

```bash
warrant red-team -- node your-agent.js
```

**Reproduce published scorecards** (sandbox agent in this repo, Groq `openai/gpt-oss-20b`):

```bash
pnpm run eval:scorecard -- --guard OFF
pnpm run eval:scorecard -- --guard ENFORCE
pnpm run eval:scorecard -- --held-out --guard ENFORCE
```

Clone + `pnpm install`, set `GROQ_API_KEY` in `.env` (see [`.env.example`](.env.example)).

---

## Results (v1 — document injection lab)

Corpus: **60** tuned attacks (families A–F) · **24** benign · **15** held-out (not used to tune guard rules). Hijack = deterministic facts (unauthorized tool, wrong pinned parameter, canary leak) — never an LLM judge.

| Scenario | Attack-stop | Benign-pass |
| -------- | ----------- | ----------- |
| Guard **OFF** (tuned, 60×) | — (**17 / 60 hijacked**) | **23 / 24** |
| Guard **ENFORCE** (tuned) | **60 / 60** | **22 / 24** |
| Guard **ENFORCE** (held-out, 15×) | **15 / 15** | — |
| Proxy-style intent (`eval:intent-scorecard`) | **59 / 60** (heuristic & LLM) | **23 / 24** |

PromptGuard (`llama-prompt-guard-2`, detection baseline): `pnpm run eval:baseline` after `eval:seed` (Postgres). Warrant reports **attack-stop and benign-pass together** — either alone is misleading.

<details>
<summary>Method notes & older matrix</summary>

- Target model: **`openai/gpt-oss-20b`** via Groq (`--model` override). Comma-separated `GROQ_API_KEY` rotates on 429.
- Realistic-recipient repeat harness (legacy): **21 / 46 hijacked** with guard OFF (5×10 matrix).
- After changing payload files: `pnpm run eval:seed` so the lab DB matches.

</details>

---

## How it works

```text
User turn  →  derive + freeze warrant  →  agent reads untrusted content (tainted)
                    ↓
            every sensitive tool call  →  allowed?  →  execute or deny
```

1. **Derive** explicit permissions from the user request (not from documents).
2. **Freeze** before any untrusted bytes enter context.
3. **Enforce** on each sensitive tool call (and pinned parameters when authorized).
4. **Optional** human approval for ambiguous cases ([`docs/APPROVAL.md`](docs/APPROVAL.md)).

Detection filters (e.g. PromptGuard) flag text; Warrant **authorizes actions**. An unseen attack still fails if it was never permitted.

---

## CLI reference

| Command | What it does |
| ------- | ------------- |
| `warrant init` | Create `.warrant/proxy-policy.json` |
| `warrant guard -- <cmd>` | Run your agent behind the guard proxy |
| `warrant scan -- <cmd>` | Hijack-test any agent, no changes to it required |
| `warrant red-team -- <cmd>` | OFF vs ENFORCE on the injection corpus |
| `warrant doctor` | Environment + registry check |
| `warrant attack` / `warrant eval intent` | Lab development only |

From this monorepo: `pnpm run warrant <command>`.

**Policy highlights** (`.warrant/proxy-policy.json`):

| Key | Default | Role |
| --- | ------- | ---- |
| `intentMode` | `heuristic` | User-turn intent; `llm` optional |
| `approvalMode` | `prompt` | TTY approve/deny for eligible blocks |
| `streaming` | `guard` | Buffer OpenAI SSE, apply guard, return stream |

OpenAI `/v1/chat/completions`, Anthropic `/v1/messages`, Gemini `generateContent` (native or OpenAI-compat). Cursor hooks: [`docs/CURSOR_HOOK.md`](docs/CURSOR_HOOK.md).

---

## Lab app & playground

**Live:** [warrant-lab.vercel.app](https://warrant-lab.vercel.app/)

| Route | Purpose |
| ----- | ------- |
| `/` | Thesis + measured comparison |
| `/playground` | Recorded terminal (`install`, `attack`, `guard` demos — no live model) |
| `/dashboard` | Stored runs with dual metrics |
| `/method` | Warrant issuance model |
| `/suites` | Attack + benign payload catalog |

**Run the lab locally:**

```bash
pnpm install
cp .env.example .env
pnpm run db:up && pnpm run db:migrate   # optional, for dashboard DB
pnpm run dev
```



<p align="center">
  <img width="1679" height="927" alt="image" src="https://github.com/user-attachments/assets/9c04cf33-fa67-4de4-aa14-6d7a8fb3bfa9" />
  <img width="1588" height="947" alt="image" src="https://github.com/user-attachments/assets/629f7304-3424-4d58-bcd4-80121bb01644" />
  <img width="1643" height="943" alt="image" src="https://github.com/user-attachments/assets/9c3429af-3b44-4978-ae48-602722a38801" />



</p>

---

## Developer commands

**Quality gate (CI):**

```bash
pnpm run verify
```

**Single sandbox case:**

```bash
pnpm run run:sandbox              # guard ENFORCE
pnpm run run:sandbox:baseline     # guard OFF
```

**Full eval matrix** (see also `pnpm run eval:full`, `eval:held-out`, `eval:drift`, `eval:attack-repeat`):

```bash
pnpm run eval:intent-scorecard
pnpm run build:guard && pnpm run build:cli
```

| Layer | Stack |
| ----- | ----- |
| App | Next.js 16, React 19, Tailwind 4 |
| Core guard | Framework-free TypeScript in `src/core/` → `@warrant-lab/guard` |
| Data | PostgreSQL 17 + Prisma 7 (lab only) |
| Models | Groq + OpenAI (sandbox / baselines) |

---

## Documentation

| Doc | Contents |
| --- | -------- |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | Tool-loop + HTTP proxy integration |
| [`docs/SCAN.md`](docs/SCAN.md) | Scanning a third-party agent for hijacks |
| [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Scope, adversary, residual risk |
| [`docs/HELD_OUT.md`](docs/HELD_OUT.md) | Held-out corpus rules |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Vercel + Neon |
| [`docs/V1_DONE.md`](docs/V1_DONE.md) | v1 completion checklist |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |

---

## Safety

Sandbox only: **mock tools**, **fake canary** (`SANDBOX-SECRET-7Q4Z` in eval), no real secrets or third-party systems. Defensive measurement for agents you own.

---

## Repository

[github.com/ahmadmustafa02/warrant](https://github.com/ahmadmustafa02/warrant) · MIT · `pnpm run verify` before PRs

**Maintainers — publish packages** (after verify):

```bash
pnpm run build:guard && pnpm run build:cli
cd packages/guard && npm publish --access public
cd ../cli && npm publish --access public
```

Scope on npm: **`@warrant-lab/*`**.
