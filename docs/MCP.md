# MCP proxy (`warrant guard --mcp`)

Agents that call tools over MCP never send those calls through `OPENAI_BASE_URL`.
`--mcp` sits on the MCP stdio wire instead, and uses the same warrant rules.

```bash
warrant guard --mcp --user "Summarize document doc-1" -- node mcp-server.js
```

Point the MCP client at Warrant, not at the real server. Warrant starts the
command after `--` and forwards JSON-RPC. `tools/list` records the advertised
tools. `tools/call` is judged against `--user` (or `WARRANT_USER_TURN`).

A denied call never reaches the server. The client gets an MCP tool result with
`isError: true`. DETECT_ONLY forwards the call and writes `would-deny` to the
decision log. stdout is the MCP wire only — banners go to stderr.

This is separate from Cursor's `beforeMCPExecution` hook, which only runs inside
Cursor and treats every MCP call as one generic `mcp_invoke`.
