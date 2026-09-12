# Deploying the Warrant demo app

Stack: **Next.js** on Vercel (or similar) + **Postgres** (Neon recommended) + **Groq** for the
sandbox agent and PromptGuard baseline.

## Environment variables

Copy from `.env.example`. Required in production:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string |
| `GROQ_API_KEY` | Playground + eval target model |
| `SANDBOX_CANARY_SECRET` | Fake credential for hijack detection |

Optional: `OPENAI_*` for analysis features if enabled later.

## Database

1. Create a Neon (or other) Postgres 17 database.
2. Set `DATABASE_URL` on the host.
3. On deploy or locally: `pnpm run db:deploy`
4. Seed once: `pnpm run eval:seed`

## Vercel

1. Import the GitHub repository.
2. Set environment variables in the project settings.
3. Build command: `pnpm run build` (default).
4. After first deploy, run migrations against production `DATABASE_URL` from CI or locally.

The **playground** uses your Groq key and an in-memory **24 runs/hour per IP** limit. For a
public demo, monitor Groq usage and tighten limits if needed.

## Post-deploy checklist

- [ ] `/playground` — attack preset, guard off then on
- [ ] `/dashboard` — at least one completed `eval:full` run
- [ ] Landing numbers match latest measured runs (or wire live comparison)
