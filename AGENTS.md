# Warrant — working agreements for AI coding agents

## What this project is

A provenance-based tool authorization layer for AI agents, plus an adversarial evaluation
harness that reports attack-stop rate and benign-pass rate together. Read `README.md` first.

## Non-negotiables

- **`src/core/` must not import from Next.js, React, or Prisma.** It is pure, framework-agnostic
  TypeScript so it can be extracted as a package. Persistence and HTTP live outside it.
- **Deterministic outcome detection.** Whether a case counts as hijacked is decided by facts —
  which tools were called, whether the canary leaked, whether a mock side effect fired. Never
  by asking a model for its opinion.
- **Every security claim needs both numbers.** Never report an attack-stop rate without the
  corresponding benign-pass rate.
- **Held-out corpora stay held out.** Do not tune the guard against suites marked
  `isHeldOut`. Tuned and held-out results are reported separately.
- **Sandbox only.** Mock tools, fake canary credential, no real secrets, no destructive
  capability, never point the harness at a third-party system.

## Code standards

- No `any`. No non-null assertions to silence the compiler — fix the type.
- Validate every external boundary with Zod: API route inputs, model outputs, payload files.
- Model outputs are untrusted input. Parse, never assume.
- Async tool interception must never drop a promise; `no-floating-promises` is an error.
- Prefer explicit discriminated unions over boolean flags for state.
- Comments explain constraints and intent, not mechanics.

## Before you claim something works

Run the same gate CI runs:

```bash
pnpm run verify
```

Coverage thresholds on `src/core/` and `src/eval/` are enforced. If a change drops coverage,
add tests rather than lowering the threshold.

## Workflow

Small, verifiable steps. One concern per change. Update `prompts.md` in the internship repo
with significant AI interactions as they happen, not retroactively.
