# Approval escalation

Warrant **denies** or **allows** tool calls by default. In the CLI proxy, eligible
ENFORCE denials can become an **interactive approval** instead of an immediate block.

## CLI behavior (`warrant guard`)

When `.warrant/proxy-policy.json` has `"approvalMode": "prompt"` (default) and
stdin is a TTY:

1. Selected denials pause the proxy and show a structured prompt (tool, risk tier, code, args).
2. **Approve once** adds that tool to the **current turn’s warrant** and re-evaluates the call.
3. **Deny** keeps the block; the model response is rewritten like any other denial.

Every decision is appended to `.warrant/approvals.jsonl` for audit.

Use `--no-approval` or `"approvalMode": "deny"` for CI and non-interactive runs.

### Never approvable

These stay hard denies — untrusted content must not unlock them via a click-through:

- `AUTHORITY_PARAMETER_FROM_CONTENT`
- `AUTHORITY_PARAMETER_MISSING`
- `PINNED_PARAMETER_CONFLICT`
- `UNKNOWN_TOOL`
- Tool-set **drift** (capability appeared after baseline)

### Lab / Prisma

The playground database model `ApprovalRequest` is for durable, multi-user review on
[warrant-lab](https://warrant-lab.vercel.app/). The CLI uses the local JSONL audit log;
wire the same events into Prisma when building in-app approval UX.

Integrators with structured UX should prefer **`issueWarrantFromExplicit`** from
`@warrant-lab/guard` rather than relying on terminal prompts.
