# Warrant roadmap (locked 27 Sep 2026)

Work top to bottom, one item at a time. Do not start the next item until the
current one is done, tested, and pushed. Changes to this list are deliberate,
not drive-by.

Model column: which model to switch to for that step. "Plan" means design and
research; "Build" means implementing an agreed design.

## Before the 5 Oct mentor demo (no big features)

| # | Item | Done when | Plan | Build |
| --- | --- | --- | --- | --- |
| 0.1 | Fix OpenAI key | `scripts/probe-model-keys.ts` shows OpenAI HTTP 200 | — | any |
| 0.2 | `prompts.md` catch-up | Phase 3 entries through `warrant scan` logged | — | Composer |
| 0.3 | Demo rehearsal | scan then guard on `scripts/realistic-test-agent.ts`, live Groq, twice | — | any |

## Start now (27 Sep), aim to show item 1 at the 5 Oct demo

| # | Item | Done when | Plan | Build |
| --- | --- | --- | --- | --- |
| 1 | Adaptive attacker agent | **Done, pushed `bd91a8b`.** `warrant scan --adaptive` reads the target's advertised tools, writes a line per sensitive tool, retries ignored lines (default 2 rounds); scoring stays `scoreScanFinding`; fixed corpus stays the default | Opus 5.5 | Composer / Grok 4.7 |
| 2 | Guard decision log + dashboard | **Done.** Every allow/deny written to `.warrant/decisions.ndjson`; viewed with `warrant log` and a local `/decisions` page. Plan: `plans/02-decision-log.md` | Opus 5.5 (schema) | Composer |
| 3 | Honest benign testing | **Done.** `warrant scan --benign TASK` (repeatable) runs each normal task with the guard on and reports a false block per task, with a benign-pass rate | — | Composer |
| 4 | Publish CLI 0.2.0 | **Last.** After 5–11. `npm install -g @warrant-lab/cli` includes scan, adaptive, log, MCP | — | any |

## Before 5 Oct (everything else)

| # | Item | Done when | Plan | Build |
| --- | --- | --- | --- | --- |
| 5 | Reflection doc (what AI did well, where it failed) | written | Opus 5.5 | — |
| 6 | Slides: problem → solution → demo → learnings | written | Opus 5.5 | — |
| 7 | 5-minute demo video | recorded | — | — |
| 8 | MCP proxy mode (`warrant guard --mcp`) | **Done.** `warrant guard --mcp --user TEXT -- <server>` judges `tools/call` with the same warrant as the HTTP proxy | Opus 5.5 | Composer / Grok 4.7 |
| 9 | OpenAI Responses API + Vercel AI SDK support | **Done.** `POST /v1/responses` (plain and streamed) is guarded like chat completions; tested with the official `openai` SDK and live on Groq. The Vercel AI SDK's OpenAI provider uses this endpoint; its own run is item 10 | Opus 5.5 | Composer |
| 10 | Real-framework tests: LangChain (Python), Vercel AI SDK | **Done.** `examples/langchain-agent` (chat completions) and `examples/vercel-ai-agent` (`openai.responses`). Adaptive scan exit 0 on both: the probe landed in the tool result, neither agent called `send_email`, benign summarize passed. `warrant guard --no-approval` exit 0 on both. See `docs/FRAMEWORKS.md` | — | Grok 4.7 |
| 11 | Shareable hosted scan report | a scan result opens as a URL | Opus 5.5 | Composer |

## Follow-ups locked 27 Sep (after item 10)

Do these in order. Same rule: finish, test, and push one before the next.

| # | Item | Done when |
| --- | --- | --- |
| F1 | Responses secret tracking | **Done.** A `function_call_output` from a secret-returning tool is remembered and stripped from the reply, same as a chat `role: tool` result. Ordinary document text is not stripped |
| F2 | Document echo is not a secret leak | **Done.** Repeating the planted marker is `marker-echoed` and does not fail the scan. A sensitive tool the guard still allows is `VULNERABLE`. Secret-tool values are stripped by F1 |
| F3 | Attacks aimed at the agent's own tools | **Done.** Adaptive scan plants direct, false-approval, multi-step, and hidden-character lines that name only advertised tools, then generator retries if those are ignored |
| F4 | Re-run LangChain and Vercel | **Done.** Both exit 0. LangChain: direct line, stop rate 1/1, benign 1/1, marker not repeated under the guard. Vercel: direct and false-approval ignored, multi-step called `send_email`; guard blocked the tool and the planted marker was still repeated (`marker-echoed`); stop rate 1/1, benign 1/1 |
| F5 | Item 11, then publish | Hosted scan report, then CLI 0.2.0 last |

## Model rule of thumb

- **Opus 5.5:** anything where a wrong design is expensive — attacker loop,
  scoring rules, schemas, security claims, reflection and slides.
- **Composer:** implementing a design that is already written down; fast edits,
  tests, docs.
- **Grok 4.7:** larger mechanical builds and integration work across many files.
- **Fable 5.1:** not needed on this list.
- Switch back to Opus whenever a build step hits a design question.
