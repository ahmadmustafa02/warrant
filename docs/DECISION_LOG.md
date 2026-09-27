# Decision log

`warrant guard` and `warrant scan` append one line per tool call the guard
judges. The file is `.warrant/decisions.ndjson` in the directory you ran the
command from. Nothing here needs Postgres.

```bash
warrant guard -- node their-agent.js
warrant log
```

`warrant log` shows the last 50 decisions from guard runs, newest first, grouped
by session. Each session lists how many calls were allowed and how many were
denied together.

| Flag | Effect |
| --- | --- |
| `--denied` | List only `denied` and `would-deny`. Session counts still include allows. |
| `--include-scan` | Also show scan runs. Hidden by default, because a scan provokes denials on purpose. |
| `--session ID` | One session. |
| `--limit N` | How many rows to show. Default 50. |
| `--json` | Machine-readable output. |

`would-deny` is a DETECT_ONLY result: the guard would have stopped the call and
did not, because enforcement was off. It is not the same as `denied`.

## What is stored

Tool name, risk tier, verdict, reason code, a short reason, timestamp, and which
run it came from. Tool arguments, prompts, and API keys are not stored. During a
scan the planted credential is replaced with `[canary]` before the line is written.

Set `WARRANT_DECISION_LOG=off` to disable writing. Set it to a path to move the
file. Past 5 MB the current file is renamed to `decisions.1.ndjson` and a new
file starts. One previous file is kept.

A failed write prints one warning and does not change what the guard allows or
blocks.

## On the lab site

`/decisions` reads the same file from the directory `pnpm dev` was started in.
If the file is missing — including on the hosted site — the page says so and
shows the command to start logging.
