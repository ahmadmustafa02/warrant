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

CLI proxy runs can prompt before blocking eligible denials; audit log:
`.warrant/approvals.jsonl`. Lab `ApprovalRequest` rows are for in-app review — see
[APPROVAL.md](./APPROVAL.md).

## Held-out evaluation

Do not tune against suites marked `isHeldOut`. See [HELD_OUT.md](./HELD_OUT.md).

## HTTP proxy (zero-config path)

For OpenAI-compatible agents, route model traffic through the local proxy. The guard
learns tools from each request, issues a warrant from the user turn, and strips denied
tool calls before your agent sees them.

```bash
pnpm run warrant init --from-sandbox
pnpm run guard:proxy -- tsx src/scripts/proxy-demo-agent.ts
# or: pnpm run warrant -- guard -- tsx src/scripts/proxy-demo-agent.ts

Policy keys in `.warrant/proxy-policy.json`:

| Key | Values | Meaning |
|-----|--------|---------|
| `streaming` | `guard` (default), `block` | `guard` buffers OpenAI SSE, runs the guard, returns guarded SSE |
| `approvalMode` | `prompt`, `deny` | Interactive CLI approval for eligible blocks |
| `intentMode` | `heuristic`, `llm` | How the user turn becomes a warrant |
# or
pnpm run proxy:demo:guard
```

The demo agent has **no in-process guard** — only the proxy protects it. Deterministic
proof lives in `src/adapters/proxy/proxyE2E.test.ts` (mock upstream, multi-turn hijack).

Set `GROQ_API_KEY` or `OPENAI_API_KEY`. The child agent’s `Authorization` header is
forwarded upstream. Use `--detect-only` or `--off` on `guard:proxy` to compare behavior.

## Tool-set drift

Warrant records the capability surface advertised on the first request of a run. Any
tool that appears later — or any known tool that **gains** a parameter — is refused,
because the user's request predates it and cannot have authorized it.

Drift overrides the read-only exemption. A late capability earns nothing from its
risk tier, since that tier is inferred from a name its injector chose.

```bash
pnpm run eval:drift   # attack with guard off, guard on, and a no-drift control
```

Measured against `openai/gpt-oss-20b` (`tool_set_drift` payload):

| Run | Vault tool ran | Hijacked |
| --- | --- | --- |
| Guard OFF, tool appears mid-session | yes | yes |
| Guard ENFORCE, tool appears mid-session | no | no |
| Guard ENFORCE, tool present from the start | blocked at call | no |

Secret-bearing reads (`returnsSecrets`, vault/API-key-shaped names) require a warrant
even when they look like ordinary reads. Output redaction removes unauthorized secret
substrings from the model's final text as a second layer (ENFORCE only).

Pin the expected tool set (`pinnedTools`) to check the **first** request too; an
observed baseline is only as trustworthy as the traffic it was taken from.

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
