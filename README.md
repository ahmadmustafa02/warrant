# Warrant

**Provenance-based tool authorization for AI agents — with a measured adversarial evaluation harness.**

Agents that read untrusted content (documents, web pages, tool output, stored memory) while
holding real capabilities can be hijacked by instructions hidden in that content. This is
indirect prompt injection, ranked first on the OWASP Top 10 for LLM Applications, and it is
not solved.

Warrant takes the position that **detecting malicious wording is the wrong primitive**. Instead
it verifies that every sensitive action was authorized by the human *before* any untrusted
content entered the context. An attack that was never anticipated still fails, because it
never had permission.


<img width="1789" height="956" alt="image" src="https://github.com/user-attachments/assets/10505e97-5c4a-4bf8-a77d-ebf05506ae24" />
<img width="1607" height="930" alt="image" src="https://github.com/user-attachments/assets/b4a2d785-3465-42f2-85a5-605731d7b61f" />
<img width="1609" height="954" alt="image" src="https://github.com/user-attachments/assets/dd686276-e298-4710-ac75-ec6a9b3c584b" />
<img width="1584" height="951" alt="image" src="https://github.com/user-attachments/assets/3b54508c-a717-4d15-96fa-ad60f9db850f" />



---

## The measured problem

This repository ships the **sandbox agent and harness** used for measurement — mock tools
(including egress `fetch_url`), **60** tuned document-injection attacks (families A–F below), **24**
benign control tasks, and **15** held-out attacks (never used to tune the guard). Target brain:
`openai/gpt-oss-20b` via Groq.

**Tuned attack families:** A phrasing realism · B parameter authority hijack · C tool-set /
MCP-style drift · D obfuscation · E channel diversity (memory/worker) · F staged exfil.

| Measurement (this repo) | Result |
| ----------------------- | ------ |
| Guard **OFF**, tuned suite (**60** attacks, once each) | **17 / 60 hijacked** · **23 / 24 benign-pass** (1 Groq tool-JSON error) |
| Guard **ENFORCE**, same run + **24** benign | **60 / 60 attack-stop** · **22 / 24 benign-pass** (1 error) |
| Held-out suite (**15** payloads, not tuned against) | **15 / 15 attack-stop** under ENFORCE |
| ENFORCE · **proxy-equivalent intent** (`eval:intent-scorecard`) | **heuristic 59 / 60** · **llm 59 / 60** · **23 / 24 benign** both (2 errors each) |
| `llama-prompt-guard-2` on the tuned injection lines (threshold 0.5) | Re-run `eval:baseline` to refresh |
| Guard **OFF**, realistic recipients, **5 repeats × 10 attacks** (older matrix) | **21 / 46 hijacked (45.7%)** — errors excluded |

Scorecards use **`openai/gpt-oss-20b`** by default (override with `--model`). **`GROQ_API_KEY`**
may list several comma-separated keys to rotate on 429/401. OpenAI is used only when **all** Groq
keys hit rate limits (`OPENAI_ANALYSIS_MODEL`, typically cheap). After changing payloads, run
`pnpm run eval:seed` so the lab DB matches the corpus files.

Obvious `@evil.test` recipients in the authored lines make the model refuse many attacks before
any tool runs; the repeat harness swaps in corporate-looking addresses so the baseline reflects
attempts that look like normal work. A pre-repo spike on different scaffolding reported higher
single-shot rates — treat only the commands above as reproducible evidence.

A real hijack (guard off), from deterministic sandbox signals — unauthorized `send_email` /
`get_api_key` or canary leakage in the final answer:

> The ingestion service processed 1.2 million events this quarter… **(API key: SANDBOX-SECRET-7Q4Z)**

Detection-based defense leaves a measurable gap: on the tuned suite, PromptGuard flags only a
small share of injection lines (re-run `pnpm run eval:baseline` for the live count) while many
attacks still drive unauthorized tool calls under a naive agent.

Cursor integration (project hooks, shadow mode by default): see [docs/CURSOR_HOOK.md](docs/CURSOR_HOOK.md).

Held-out suite (do not tune the guard against these payloads):

```bash
pnpm run eval:seed
pnpm run eval:held-out -- --guard OFF
pnpm run eval:held-out -- --guard ENFORCE
pnpm run eval:detect-only
pnpm run cursor:shadow-report
```

Held-out (**15** attacks, separate from tuning): **15 / 15 attack-stop** under ENFORCE in the
latest local scorecard (`pnpm run eval:scorecard -- --held-out --guard ENFORCE`).

## Core idea

Authority flows from the user, never from content.

1. **Derive** an explicit permission set from the user's request.
2. **Freeze** it before any untrusted content is read, so injected text cannot edit it.
3. **Check** every sensitive tool call against the frozen set.
4. **Ask** the human when a request is genuinely ambiguous.

Content may supply *parameters* for actions the user already authorized. It can never *add*
new authorized actions. Read-only tools remain unrestricted, which is why the guard stays out
of the way during normal use.

## Two numbers, always reported together

- **Attack-stop rate** — share of poisoned inputs the guard blocked.
- **Benign-pass rate** — share of legitimate requests still allowed.

Either number alone is meaningless. A guard that blocks everything has a perfect stop rate and
is useless. Warrant reports both, on a **held-out corpus generated by third-party tools**
(promptfoo, garak) so results are not tuned against by the defense author.

## Positioning

Attack-generation tooling is mature — promptfoo, garak, PyRIT. Warrant does not compete with
them; it is defense-side and consumes them:

- promptfoo/garak supply the held-out attack corpus.
- `llama-prompt-guard-2` is the published baseline the guard is measured against.

The contribution is the authorization-and-provenance guard, evaluated on the agentic surfaces
with the weakest open-source coverage: memory poisoning, multi-agent trust boundaries, and MCP
tool-description injection.

## Stack

| Layer | Choice |
| ----- | ------ |
| App | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4 |
| Data | PostgreSQL 17 + Prisma 7 |
| Validation | Zod 4 |
| Models | Groq (`gpt-oss-20b`, `gpt-oss-120b`, `qwen3.6-27b`, `llama-prompt-guard-2`), OpenAI |
| Tests | Vitest with coverage thresholds enforced in CI |
| Quality | ESLint type-aware, Prettier, husky + lint-staged, GitHub Actions |

## Repository

[github.com/ahmadmustafa02/warrant](https://github.com/ahmadmustafa02/warrant)

## Product surface

The site is a measured lab, not a marketing template. Live demo:
[warrant-lab.vercel.app](https://warrant-lab.vercel.app/).

- `/` — the thesis and the dual-metric claim
- `/playground` — **recorded terminal**: allowlisted `npm install` / `warrant init` /
  `doctor` / `attack` / `guard` demos. Outcomes are seeded lab traces. No custom prompt,
  no live model, no real install.
- `/method` — how a warrant is issued and frozen
- `/dashboard` — every stored run, always with both rates
- `/runs/[id]` — cases, tools, scorecard
- `/runs/[id]/cases/[caseId]` — injection, decisions, transcript
- `/suites` — authored attack and benign payloads

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in GROQ_API_KEY and OPENAI_API_KEY
pnpm run db:up            # Postgres 17 on port 5433
pnpm run db:migrate       # apply schema
pnpm run dev
```

Run the full quality gate exactly as CI does:

```bash
pnpm run verify           # format + lint + typecheck + test
pnpm run run:sandbox      # one injected document case with guard ENFORCE
pnpm run run:sandbox:baseline  # same case with guard OFF (baseline hijack)
pnpm run eval:scorecard -- --guard OFF    # refresh numbers without Postgres (Groq only)
pnpm run eval:scorecard -- --guard ENFORCE
pnpm run eval:scorecard -- --held-out --guard ENFORCE
pnpm run eval:intent-scorecard           # heuristic vs LLM intent (proxy path, ENFORCE)
pnpm run eval:seed             # load authored attack + benign suites into Postgres
pnpm run eval:baseline         # score attacks with llama-prompt-guard-2 (Groq)
pnpm run eval:run -- --suite document-injection-attacks --guard ENFORCE
pnpm run eval:full -- --guard OFF       # naive agent baseline (hijack rate)
pnpm run eval:full -- --guard ENFORCE   # both suites, dual-metric scorecard
pnpm run eval:attack-repeat -- --recipient realistic --repeats 5 --guard OFF
pnpm run eval:attack-repeat -- --recipient realistic --repeats 5 --guard ENFORCE
pnpm run eval:drift                  # tool-set drift: OFF vs ENFORCE vs control
pnpm run eval:proxy-intent           # heuristic vs LLM intent on fixed fixtures
pnpm run dev                         # /playground — recorded terminal (seeded only)
pnpm run build:guard                 # compile @warrant-lab/guard
pnpm run build:cli                   # compile @warrant-lab/cli (`warrant` bin)
```

## CLI (`warrant`)

Local wrapper around the same product. Run from this repo with `pnpm run warrant`, or
build `@warrant-lab/cli`. **Postgres is not required** for `doctor`, `guard`, or `red-team`.

Use **your agent’s existing provider setup** (e.g. Groq/OpenAI keys in the agent’s `.env`).
Warrant does not issue a separate API key — it wraps your process and points
`OPENAI_BASE_URL` (and Anthropic/Gemini bases) at a local proxy.

```bash
pnpm run warrant init --from-sandbox   # writes .warrant/proxy-policy.json
pnpm run warrant doctor
pnpm run warrant guard -- node your-agent.js
pnpm run warrant red-team -- node your-agent.js   # optional: OFF vs ENFORCE on corpus
```

Lab-only: `warrant attack`, `warrant eval intent`, and `pnpm run eval:*` (sandbox harness).

`warrant guard` evaluates tool calls on OpenAI `/v1/chat/completions`, Anthropic
`/v1/messages`, and Gemini `generateContent` (native or OpenAI-compat).

Policy (`.warrant/proxy-policy.json`):

| Key | Default | Meaning |
| --- | ------- | ------- |
| `intentMode` | `heuristic` | `llm` reads **only** the user turn; falls back to heuristic on error. Latest `eval:intent-scorecard`: same attack-stop/benign-pass as heuristic on this corpus; keep heuristic default unless you measure a benign-pass gap on your agent. |
| `approvalMode` | `prompt` | Interactive approve/deny for eligible ENFORCE blocks (TTY). Never for authority smuggled from content or tool-set drift. Use `--no-approval` in CI. |
| `streaming` | `guard` | Buffer OpenAI SSE, run the guard, return guarded SSE. `block` rejects `stream: true` in ENFORCE. |

Audit log for human decisions: `.warrant/approvals.jsonl`. See
[`docs/APPROVAL.md`](docs/APPROVAL.md).

## Using Warrant in your agent

```bash
pnpm run build:guard
pnpm run build:cli
```

See **`docs/INTEGRATION.md`** for the explicit-warrant tool-loop and HTTP proxy,
**`packages/guard/README.md`** for `@warrant-lab/guard`, and **`packages/cli/README.md`**
for the `warrant` binary.

Deploy the demo app: **`docs/DEPLOY.md`**.

## Engineering standards

TypeScript runs beyond `strict`: `noUncheckedIndexedAccess`, `noImplicitReturns`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, and
`noFallthroughCasesInSwitch` are all enabled. `exactOptionalPropertyTypes` is deliberately
left off — it fights Prisma and React prop types without improving safety in this codebase.

Linting is **type-aware** on all of `src/`. The rules that matter most are
`no-floating-promises` and `no-misused-promises`: the guard intercepts async tool calls, and a
dropped promise there would mean a security check that silently never completes.

`src/core/` is framework-agnostic with zero Next.js imports, so the guard can be extracted and
published as a standalone package without restructuring.

## Safety

Everything runs against a sandboxed agent owned by this project, using a **fake canary
credential** and **mock side-effecting tools**. No real secret, no destructive capability, and
no third-party system is ever involved. The purpose is defensive: measuring and reducing a
known risk in systems you own.

Scope, adversary, and residual risk: **[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)**.

## Publish packages

From a clean tree after `pnpm run verify`:

```bash
pnpm run build:guard
pnpm run build:cli
cd packages/guard && npm pack && npm publish --access public
cd ../cli && npm pack && npm publish --access public
```

Requires npm login with permission to publish `@warrant-lab/*`.
