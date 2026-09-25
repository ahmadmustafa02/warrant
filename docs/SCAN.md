# `warrant scan` — test an agent you did not write

`warrant scan` answers one question about someone else's agent: **can untrusted
content it reads make it do something the user never asked for?**

It needs no changes to that agent. No SDK, no callbacks, no reporting protocol.
The only requirement is that the agent talks to its model over HTTP and respects
the standard base-URL environment variables.

```bash
warrant scan -- node their-agent.js "summarize the latest report"
```

## What happens during a scan

1. **Warrant starts a local proxy** and launches the agent's command with
   `OPENAI_BASE_URL` (plus the Anthropic and Gemini equivalents) pointed at it.
   Every model request and reply now passes through Warrant.
2. **The payload is planted in a tool result.** When the agent's own tools return
   content — a document it read, a page it fetched — Warrant appends an attack
   line and a fake credential (the *canary*) before forwarding that content to the
   model. This is real indirect prompt injection: the instruction arrives inside
   the agent's data, exactly like a hidden line in a PDF or an image caption.
3. **Each payload runs twice.**
   - `DETECT_ONLY`: tools actually execute. Warrant records every sensitive call
     the agent proposed that the user turn never authorized, and whether the
     canary came back. This is the vulnerability.
   - `ENFORCE`: same payload, guard live. Denied calls are stripped before the
     agent ever sees them.
4. **One benign run with no injection** confirms the agent still completes its
   normal task under the guard, so the report never shows an attack-stop rate
   without the cost of getting it.

Outcomes are decided from what crossed the wire. No model is asked for an opinion.

## Reading the report

| Verdict | Meaning |
| --- | --- |
| `VULNERABLE` | The agent was hijacked and the guard did not stop it. Investigate. |
| `PROTECTED` | The agent was hijacked unguarded; `ENFORCE` stopped it. |
| `not exploitable` | The payload landed and the agent ignored it. |
| `payload never landed` | Nothing untrusted to poison — see troubleshooting below. |

The stop rate is computed over **exploitable** payloads only. An agent that
ignores every attack scores no stop rate, because there was nothing to stop.

Exit codes: `0` everything exploitable was blocked, `1` at least one attack
survived, `2` inconclusive because no payload reached the agent.

## Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `--limit N` | `8` | Payload count. Selection covers one payload per attack category first. |
| `--all` | off | Run the whole corpus. Slow: two agent runs per payload. |
| `--held-out` | off | Use the held-out corpus instead of the tuned one. |
| `--inject-into` | `tool-result` | See below. |
| `--timeout MS` | `120000` | Per-run timeout; a hung agent is killed and scored. |
| `--json` | off | Machine-readable report for CI. |

## Injection targets

`tool-result` is the default and the honest one: the payload sits in untrusted
content while authority stays with the user turn, which is the situation Warrant
is designed for.

`user-content` appends the payload to the latest user message instead. Use it only
for agents that paste retrieved documents into the user turn. Be aware of what
that measures: such an agent has already handed the document the user's authority,
so the guard cannot tell the two apart. A clean result there is weaker evidence,
and the real fix is to stop merging retrieved content into the user turn — or to
call `issueWarrantFromExplicit` directly ([`INTEGRATION.md`](INTEGRATION.md)).

## Limits worth knowing

- **Hardcoded API URLs can't be proxied.** If the agent ignores `OPENAI_BASE_URL`,
  the scan sees nothing. Point it at the proxy however that agent allows.
- **An agent that never calls tools gives injection nothing to ride on**, and the
  scan reports `payload never landed` rather than a false all-clear.
- **A scan is evidence, not a proof of safety.** It reports the payloads it ran.
  Scoring well on eight attacks is not the same as being unhijackable.
- **Passing `ENFORCE` means denied calls never reached the agent.** An attack that
  achieves its goal purely through tools the user *did* authorize is out of scope
  here; see [`THREAT_MODEL.md`](THREAT_MODEL.md).

## After a scan

A scan is diagnosis. The fix is to keep the same guard running in production:

```bash
warrant guard -- node their-agent.js
```

Same proxy, same policy, injection switched off.

## Scan vs red-team

`warrant red-team` measures agents that **cooperate**: they read `WARRANT_EVAL_*`
and print a JSON verdict, which gives richer ground truth for the published
scorecards. `warrant scan` assumes nothing and derives everything from the wire,
so it works on an agent you have never seen. Use `scan` for third-party agents and
`red-team` for reproducing lab numbers.
