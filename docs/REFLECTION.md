# Reflection — what the AI did well, and where it failed

Written 29 Sep 2026, before the mentor demo. Updated 1 Oct 2026 after the pasted-tool-output fix, the harmless-new-tool rule, and the site redesign. The product claims below are the ones already measured and pushed. This note is about the building process, not a new scorecard.

## What went well

- The guard stayed deterministic. Hijack is still decided from the wire: which tool ran, whether a pinned address changed, whether a canary leaked. A model is not asked to grade itself.
- Attack-stop is reported next to benign-pass. Full scan mode keeps that rule per attack shape.
- The protections that shipped after the first lab are specific and testable: recipient origin, secret removal, the current user message only, and a saved tool list.
- Scans work on agents that do not import Warrant. LangChain and the Vercel AI SDK were run that way, on Groq, with the guard off and on.
- Small steps, each tested and pushed, kept a wrong design from spreading across the repo.
- A tool result that a framework pastes back as a user message no longer becomes the permission. A harmless new tool such as `final_answer` is saved. A risky new tool, or a tool that gains a parameter, still waits for a person.
- The public site was restyled and deployed. The live commands on the page are `warrant scan`, then `warrant guard`. `warrant attack` is described as a lab replay.

## Where it failed

- A prompts log was rewritten with the wrong file tool and em dashes across the whole document became question marks. Restoring it took an extra commit. Later entries were appended as bytes so the rest of the file stayed put.
- The OpenAI key still returns HTTP 401. Live runs use Groq. That is an account problem, not a guard bug, and it was not fixed by retrying the same key.
- The first saved tool list can still be poisoned if that first run is already attacked. Later runs are protected. Deleting `.warrant/tool-pin.json` starts the list over. A tool that changes what it does without adding a parameter is still invisible.
- An early roadmap line said neither framework agent called `send_email`. The later Vercel run did call it, and the guard blocked it. The later note is the one to quote.
- Formatting the whole repo fails on older files that use Windows line endings. Only files touched in a change were formatted.
- A shareable report was left until late. The link carries the numbers. The page has to be deployed before a teammate can open it.
- The 60 / 24 / 15 scorecard was not re-run after the 1 Oct guard changes. Those changes have tests. They are not a new measured rate.
- Two models run on Groq (`openai/gpt-oss-20b` for the lab, `openai/gpt-oss-120b` for scan probe lines). The same query was not shown live on two providers. The OpenAI key is still 401.
- `@warrant-lab/cli@0.2.0` did not include the 1 Oct guard fixes. `0.3.0` publishes them.
- The HTML slides are a short outline. The 20-minute deck is still to be made. The five-minute video is still not recorded.

## What I would do differently

Start the shareable report when scan first had two rates, so a demo never depends on a terminal scrollback. Treat the prompts log as append-only from the first week. The five-minute video still has to be recorded from `docs/DEMO_SCRIPT.md`; that recording is not in the repo.
