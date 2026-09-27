# Plan 08 — MCP stdio proxy (`warrant guard --mcp`)

Status: IMPLEMENTED 27 Sep 2026. Roadmap item 8. Publish (item 4) stays last.

## Problem

`warrant guard` today sits on the **model HTTP** call. Agents that reach tools
through MCP (Cursor, Claude Desktop, custom stdio servers) never send those
calls through that proxy. Cursor already has a hook (`beforeMCPExecution`) that
treats every MCP call as one generic `mcp_invoke`. That only works inside
Cursor, and it cannot tell `send_email` from `list_notes`.

## Goal

```
warrant guard --mcp --user "Summarize document doc-1" -- node mcp-server.js
```

Warrant becomes the MCP server the client talks to. It starts the real server
behind it, forwards JSON-RPC, and judges each `tools/call` with the same
classifier and warrant as the HTTP proxy. Scoring and logging stay
deterministic.

## Rules

- stdout is the MCP wire. No banners, spinners, or logs on stdout.
- `--user` is the frozen user turn (same role as the latest user message on HTTP).
- `tools/list` records the advertised set for drift.
- `tools/call` in ENFORCE that fails the warrant is answered with
  `isError: true` and never reaches the real server.
- DETECT_ONLY forwards and logs `would-deny`.
- OFF is a plain pipe.
- Decision log uses `source: 'guard'`.
- `src/core/` is untouched.

## Not in this item

HTTP MCP / SSE transports. Cursor-only hooks stay as they are.
