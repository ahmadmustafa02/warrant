# Changelog

## Unreleased

### Added

- Read-scope enforcement on read-only tools (pinned document ids).
- Egress-aware `fetch_url` and `guard:doctor` registry audit.
- Parameter constraints (`stringPattern`, `numberMax`) on tool definitions.
- Held-out attack suite (5 payloads) and `pnpm run eval:held-out`.
- Cursor project hooks (shadow mode) and `pnpm run cursor:shadow-report`.
- Playground: fixed eval templates and seeded lab traces.
- Lab dashboard: held-out comparison and DETECT_ONLY summary panels.

### Measured (tuned corpus, sandbox agent)

- Guard OFF: 8/12 hijacked · Guard ENFORCE: 12/12 attack-stop, 2/2 benign-pass.
- PromptGuard baseline: 2/12 flagged (threshold 0.5).

### Measured (held-out suite)

- Guard OFF: 3/5 hijacked · Guard ENFORCE: 5/5 attack-stop.

### Measured (DETECT_ONLY, tuned)

- Tools still execute; see lab dashboard for would-deny vs hijacked split on the latest run.
