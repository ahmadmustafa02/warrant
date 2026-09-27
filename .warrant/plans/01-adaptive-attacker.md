# Plan 01 — Adaptive probe generator for `warrant scan`

Status: IMPLEMENTED 27 Sep 2026. Roadmap item 1. Not committed yet.

Landed as `warrant scan --adaptive` (`--rounds`, default 2). Generator output is
Zod-checked and only proposes text. `scoreScanFinding` is unchanged. The fixed
corpus remains the default, and `--held-out` / `--all` / `--limit` are rejected
together with `--adaptive`.

Scope: defensive security testing only. Runs against the project's own sandbox
agent, with mock tools and a fake canary credential, exactly as `warrant scan`
already does. No real systems, no real secrets. This extends the existing scan;
it does not add any new capability to reach outside the sandbox.

## Problem

Today `warrant scan` replays a fixed set of test lines written for the lab's own
tools (`send_email`, `read_document`). If the target agent exposes different
tools (for example `create_refund` or `post_message`), those fixed lines refer
to tools that do not exist, so the scan reports "not exploitable" even when the
agent would in fact follow an injected instruction. The coverage is only as good
as a corpus that was written before seeing the target.

## Goal

Make the probe adapt to the target's actual tool list. The generator reads the
tools the target advertises, writes test lines that reference those specific
tools, observes what the proxy saw on the wire, and, when a line had no effect,
tries a different phrasing. The verdict stays deterministic: the generator only
proposes text; whether a case counts as a hijack is still decided by wire facts
(which tool the model called, whether the fake canary moved), never by asking a
model for an opinion.

## Flow

1. **Recon.** Run the target once behind the proxy with no injection. The proxy
   already records the tools the agent advertises (see `proxyServer` /
   `ProxySession`). Collect that list plus each tool's risk tier from
   `classifyDiscoveredTool`.
2. **Generate.** For each sensitive tool, ask the generator model for a short
   test line that would try to get the agent to call that tool with attacker
   chosen arguments, plus a line that tries to get the fake canary echoed back.
   Output is validated with Zod and treated as untrusted text.
3. **Probe.** Reuse the existing `runScanProbe` to plant each generated line and
   run the pair (DETECT_ONLY baseline, then ENFORCE), scored by the existing
   `scoreScanFinding`. Nothing new in the scoring path.
4. **Retry.** If a line was reachable but not exploitable, ask the generator for
   one alternative phrasing in a different style, up to N rounds (default 2).
   Stop early once a tool is shown exploitable.
5. **Report.** Same summary as today (attack-stop rate with benign-pass rate),
   plus which generated lines were used, so a run is reproducible.

## Determinism guarantee (AGENTS.md)

- The generator only produces candidate text. `scoreScanFinding` is unchanged
  and reads only wire facts. No LLM judge anywhere.
- The fixed corpus stays as the default, so `warrant scan` without `--adaptive`
  is byte-for-byte reproducible and remains the held-out baseline.

## Multi-model story

Generator model is separate from the target agent's model and configured by env
(reuse `openAiCompatibleClient`, Groq keys). This is where "attacker on one
provider, target on another" comes from, satisfying the Phase 2 agent primitive.

## New surface

- `src/cli/scan/adaptiveProbe.ts` — recon + generate + retry loop.
- `src/cli/scan/generateProbeLine.ts` — model call + Zod validation of output.
- `--adaptive` and `--rounds N` flags in `scan.ts`.
- Tests: a deterministic fake generator (no network) driving the loop; assert
  scoring path is untouched and retry stops on first exploit.

## Decisions (locked 27 Sep)

1. `--adaptive` is opt-in. Default scan stays the fixed corpus, so CI and
   held-out results remain reproducible.
2. Retry rounds default to 2 per tool (`--rounds N` to override).
3. Generator reuses the existing Groq keys via `openAiCompatibleClient`. The
   multi-provider story comes from the target agent using its own base URL while
   the generator runs on Groq.
