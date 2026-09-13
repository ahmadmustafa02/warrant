# Integrating Warrant into your agent

Warrant sits in **your tool loop**, not inside the model API. You own the code that turns
model output into `send_email`, `run_sql`, file writes, etc. That is where the guard runs.

## Mental model

1. **User turn** → build a warrant (explicit grants from your app, or a parser you trust).
2. **Freeze** before reading untrusted content (documents, web, tool output, memory).
3. **Every sensitive tool call** → `evaluateToolCall` with model-proposed args tagged as `WORKER`.
4. **Read-only tools** skip the guard by design — tier them honestly in your registry.

## Register tools

```typescript
import { ToolRegistry } from '@warrant/guard';

export const registry = new ToolRegistry([
  {
    name: 'read_document',
    riskTier: 'READ_ONLY',
    description: 'Read an internal document by id',
  },
  {
    name: 'send_email',
    riskTier: 'SENSITIVE',
    description: 'Send email',
    authorityParameters: ['to'],
  },
]);
```

`authorityParameters` are fields that decide **where** an action lands. Content must not
set them unless the user pinned the same value.

Optional `parameterConstraints` cap argument shape (`stringPattern` for SQL, `numberMax`
for amounts). Violations deny with `PARAMETER_CONSTRAINT_VIOLATION`.

## Issue a warrant (explicit API)

```typescript
import { issueWarrantFromExplicit } from '@warrant/guard';

const warrant = issueWarrantFromExplicit(
  [
    { tool: 'read_document', pinnedParameters: { id: 'doc-1' } },
    { tool: 'send_email', pinnedParameters: { to: 'alice@company.test' } },
  ],
  registry,
);
```

Use this when **your** product UI or workflow already knows what the user authorized.

## Intercept tool calls

```typescript
import { evaluateToolCall, denialMessage } from '@warrant/guard/agent';

async function onModelToolCall(name: string, rawArgs: string) {
  const decision = evaluateToolCall({
    mode: 'ENFORCE',
    warrant,
    registry,
    toolName: name,
    rawArguments: rawArgs,
  });

  if (decision && !decision.allowed) {
    return { role: 'tool', content: denialMessage(decision) };
  }

  return executeTool(name, rawArgs);
}
```

Reference implementation: `src/agent/runSandboxAgent.ts` in this repository.

## Provenance

Tag values as they enter the agent:

| Source              | Tag           |
| ------------------- | ------------- |
| User message        | `USER`        |
| System prompt       | `SYSTEM`      |
| Tool / document     | `TOOL_RESULT` |
| Model-proposed args | `WORKER`      |

```typescript
import { taint } from '@warrant/guard';

const body = taint(emailBodyFromDoc, 'TOOL_RESULT');
```

## Approval escalation

Hard denies are the default. A future path will surface `ApprovalRequest` rows for
human confirm — see [APPROVAL.md](./APPROVAL.md).

## Held-out evaluation

Do not tune against suites marked `isHeldOut`. See [HELD_OUT.md](./HELD_OUT.md).

## HTTP proxy (zero-config path)

For OpenAI-compatible agents, route model traffic through the local proxy. The guard
learns tools from each request, issues a warrant from the user turn, and strips denied
tool calls before your agent sees them.

```bash
pnpm run guard:proxy -- tsx src/scripts/proxy-demo-agent.ts
# or
pnpm run proxy:demo:guard
```

The demo agent has **no in-process guard** — only the proxy protects it. Deterministic
proof lives in `src/adapters/proxy/proxyE2E.test.ts` (mock upstream, multi-turn hijack).

Set `GROQ_API_KEY` or `OPENAI_API_KEY`. The child agent’s `Authorization` header is
forwarded upstream. Use `--detect-only` or `--off` on `guard:proxy` to compare behavior.

## What Warrant does not do

- It does not wrap ChatGPT, Claude.ai, or Cursor internals.
- It does not verify that first-party tool **implementations** match their descriptions
  (supply chain). Use least-privilege credentials on databases and egress.
- It is not a jailbreak detector — pair with PromptGuard or similar if you want both.
- It does not parse natural language intent for you (yet); explicit grants are the supported
  integration path today.

## Measuring your deployment

Keep **attack-stop** and **benign-pass** together. The eval harness in this repo is the
reference; point it at your agent registry and suites once your tool loop is wired.
