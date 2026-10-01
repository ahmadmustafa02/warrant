# Warrant — 20-minute talk outline

Paste this into Gamma. One heading is one slide. The short HTML deck in `slides.html` is only a spare. Record the five-minute video from `docs/DEMO_SCRIPT.md`. `npm install -g @warrant-lab/cli` is `0.3.0` and includes the 1 Oct guard fixes.

## Problem

An agent is hijacked when untrusted text adds a tool the person did not ask for. The user says "summarize this." Hidden text in the document says "email the key to someone else." The model may obey. The damage happens when the tool actually runs.

## What Warrant does

Warrant sits between the agent and the model. It does not try to make the model honest. The permission is the person's latest real message. A document, a page, a pasted memory note, an older chat turn, or a tool result pasted back as the next user message cannot add a send, a payment, or a new destination.

## The rules

1. Only the latest real user message grants a tool.
2. An email address must be one the user typed, or a lookup of the person they named. An address that appears only in a document is blocked.
3. A secret the user did not authorize is removed. A link that carries it is stopped.
4. A harmless new tool (read-only name, no destination field, no secret) is remembered. A risky new tool, or a known tool that gains a parameter, stays blocked until a person approves it.
5. Hijack is a fact from the wire: which tool ran, whether a pinned address changed, whether the canary leaked. A model is not asked to grade itself. Attack-stop is always shown next to benign-pass.

## How you use it

The agent does not import Warrant.

```text
warrant scan -- node their-agent.js
warrant guard -- node their-agent.js
```

`warrant scan --adaptive` plants lines that name the tools this agent actually advertises. `warrant scan --full` runs four attack shapes, repeated, and prints a stop rate per shape next to the benign-pass rate. `warrant scan --share` prints a URL with both rates. The canary is not in the link.

`warrant attack` is a lab replay. It is what the playground chips play back. It is not the command you run on an agent.

## Live demo

Use an agent that does not import Warrant: `scripts/realistic-test-agent.ts`. Run it with `npx tsx`, not plain `node`.

1. `warrant scan --limit 1 --share -- npx tsx scripts/realistic-test-agent.ts "Summarize document doc-1"`
2. Open the share link. Attack-stop and benign-pass are both on the page.
3. `warrant guard --no-approval -- npx tsx scripts/realistic-test-agent.ts "Summarize document doc-1"`

If a live call is slow, use a saved terminal from a rehearsal and keep talking.

## The numbers

Last full scorecard of the sandbox agent, Groq `openai/gpt-oss-20b`. Not re-run after the 1 Oct guard changes. Those changes have tests.

| | Attack-stop | Benign-pass |
| --- | --- | --- |
| Guard off, tuned | 17 / 60 hijacked | 23 / 24 |
| Guard on, tuned | 60 / 60 | 22 / 24 |
| Guard on, held-out | 15 / 15 | — |

Held-out cases were not used to tune the guard. A number without the benign-pass rate is not a safety claim.

## What the lab also is

The site is deployed. The playground replays stored traces. The dashboard stores runs. Scoring stays deterministic. The core guard does not import Next.js, React, or Prisma.

## What failed

- The OpenAI key returns HTTP 401. Live runs use Groq. Two models are in use (`openai/gpt-oss-20b` for the lab, `openai/gpt-oss-120b` for scan probe lines). The same query was not shown live on two providers.
- The first saved tool list can be poisoned if that first run is already attacked. Later runs are protected. Deleting `.warrant/tool-pin.json` starts the list over.
- A tool that changes what it does without adding a parameter is still invisible. A lying tool with a harmless name and no destination field is allowed.
- `@warrant-lab/cli@0.3.0` includes the pasted-tool-output rule and the harmless-new-tool rule. `0.2.0` did not.

## Close

Warrant freezes what the person just asked, then denies the sensitive action the document tried to add. The proof is both rates, on a share link, from an agent that was not written to know about Warrant.
