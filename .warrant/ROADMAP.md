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
| 2 | Guard decision log + dashboard | every allow/deny stored with tool, reason, timestamp; viewable on the lab site | Opus 5.5 (schema) | Composer |
| 3 | Honest benign testing | scan accepts several normal tasks; false blocks reported per task | — | Composer |
| 4 | Publish CLI 0.2.0 | `npm install -g @warrant-lab/cli` includes `scan` and the attacker | — | any |

## Week 8 deliverables (after code freeze)

| # | Item | Plan | Build |
| --- | --- | --- | --- |
| 5 | Reflection doc (what AI did well, where it failed) | Opus 5.5 | — |
| 6 | Slides: problem → solution → demo → learnings | Opus 5.5 | — |
| 7 | 5-minute demo video | — | — |

## After the internship (product launch)

| # | Item | Plan | Build |
| --- | --- | --- | --- |
| 8 | MCP proxy mode (`warrant guard --mcp`) | Opus 5.5 | Composer / Grok 4.7 |
| 9 | OpenAI Responses API + Vercel AI SDK support | Opus 5.5 | Composer |
| 10 | Real-framework tests: LangChain (Python), Vercel AI SDK | — | Grok 4.7 |
| 11 | Shareable hosted scan report | Opus 5.5 | Composer |

## Model rule of thumb

- **Opus 5.5:** anything where a wrong design is expensive — attacker loop,
  scoring rules, schemas, security claims, reflection and slides.
- **Composer:** implementing a design that is already written down; fast edits,
  tests, docs.
- **Grok 4.7:** larger mechanical builds and integration work across many files.
- **Fable 5.1:** not needed on this list.
- Switch back to Opus whenever a build step hits a design question.
