# @warrant/guard

Freeze what the **user** authorized, then enforce it on every sensitive tool call. Untrusted
document text may fill ordinary fields; it may not add tools or choose authority parameters
(recipient, path, amount) unless the user pinned them.

Zero runtime dependencies.

## Install

```bash
npm install @warrant/guard
```

(Pre-publish: build from the monorepo with `pnpm run build:guard`.)

## Quick start

```typescript
import {
  ToolRegistry,
  issueWarrantFromExplicit,
  taint,
} from '@warrant/guard';
import { evaluateToolCall } from '@warrant/guard/agent';

const registry = new ToolRegistry([
  {
    name: 'send_email',
    riskTier: 'SENSITIVE',
    description: 'Send mail',
    authorityParameters: ['to'],
  },
]);

// 1. Declare grants from your app (recommended) — do this from the user turn only.
const warrant = issueWarrantFromExplicit(
  [{ tool: 'read_document', pinnedParameters: { id: 'doc-1' } }],
  registry,
);

// 2. Before calling the model, freeze is done — warrant no longer changes.

// 3. On each model tool call:
const decision = evaluateToolCall({
  mode: 'ENFORCE',
  warrant,
  registry,
  toolName: 'send_email',
  rawArguments: JSON.stringify({ to: 'ops@company.test', body: '…' }),
});

if (decision && !decision.allowed) {
  // Return decision.reason to the model; do not execute the tool.
  throw new Error(decision.reason);
}
```

Mark tool **results** as untrusted when they re-enter context:

```typescript
import { taint } from '@warrant/guard';

const docText = taint(readDocumentResult, 'TOOL_RESULT');
```

Full walkthrough: `docs/INTEGRATION.md` in the [Warrant](https://github.com/ahmadmustafa02/warrant) repository.
