# @warrant/cli

Command-line interface for [Warrant](https://github.com/ahmadmustafa02/warrant).

```bash
warrant init --from-sandbox
warrant guard -- node my-agent.js
warrant doctor
warrant eval intent
warrant attack --payload document_injection_realistic --guard ENFORCE
```

Build from the monorepo root:

```bash
pnpm --filter @warrant/cli build
```
