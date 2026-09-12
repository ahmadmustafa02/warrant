# Approval escalation (planned)

Today Warrant **denies** or **allows** tool calls. Cursor hooks also support `permission: ask`, but the product path for in-app approval is not wired yet.

The Prisma model `ApprovalRequest` stores pending human decisions. A future release will:

1. Convert selected `ENFORCE` denials into `PENDING` approval rows instead of hard blocks.
2. Resume the agent only after `APPROVED`, with the warrant unchanged.
3. Never auto-approve authority-parameter escalations from untrusted content.

Until then, integrators should use **explicit warrants** from their own UI (`issueWarrantFromExplicit`) rather than expecting Warrant to parse free-text intent.
