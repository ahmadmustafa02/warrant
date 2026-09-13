# v1 completion checklist

Use this to confirm the internship / demo deliverable is closed.

## Code & CI

- [x] `pnpm run verify` green (format, lint, typecheck, tests + coverage thresholds)
- [x] `src/core/` framework-agnostic; guard extractable as `@warrant/guard`
- [x] CLI proxy path: `warrant guard`, `init`, `doctor`, `red-team`

## Measurement

- [x] Corpus: 60 tuned / 24 benign / 15 held-out (`corpusIntegrity.test.ts`)
- [x] Scorecards documented in README (OFF, ENFORCE, held-out, intent)
- [ ] Optional live lab DB: `pnpm run db:up` → `eval:seed` → `eval:full` → `eval:baseline`
- [ ] Optional npm publish: `@warrant/guard` and `@warrant/cli` (see root README)

## Product surface

- [x] Lab site routes: `/`, `/playground`, `/method`, `/dashboard`, `/suites`, run detail
- [x] Landing hero + evidence numbers match README
- [x] Deploy notes: `docs/DEPLOY.md`

## Docs

- [x] `docs/THREAT_MODEL.md`, `docs/INTEGRATION.md`, `docs/HELD_OUT.md`
- [x] `CHANGELOG.md` 0.1.0 entry

When the two optional items are done on your machine (Postgres + npm), you can treat v1 as
fully operational in production; the **evidence claim** already rests on CLI scorecards
without Postgres.
