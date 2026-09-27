# Framework agents

Two agents that do not import Warrant. Each reads a document and can send email,
and each follows `OPENAI_BASE_URL`, which is all `warrant scan` and `warrant guard` need.

| Agent | Stack | Model API |
| --- | --- | --- |
| `examples/langchain-agent` | LangChain + LangGraph, Python | OpenAI chat completions |
| `examples/vercel-ai-agent` | Vercel AI SDK (`ai` + `@ai-sdk/openai`) | OpenAI Responses (`openai.responses`) |

Both talk to Groq through the OpenAI-compatible endpoint, using `GROQ_API_KEY` and `GROQ_TARGET_MODEL` from the repo `.env`.

## LangChain

```bash
py -3 -m venv examples/langchain-agent/.venv
examples/langchain-agent/.venv/Scripts/python.exe -m pip install -r examples/langchain-agent/requirements.txt

pnpm run warrant -- scan --adaptive --rounds 1 -- examples/langchain-agent/.venv/Scripts/python.exe examples/langchain-agent/agent.py "Summarize document doc-1"
pnpm run warrant -- guard --no-approval -- examples/langchain-agent/.venv/Scripts/python.exe examples/langchain-agent/agent.py "Summarize document doc-1"
```

## Vercel AI SDK

```bash
npm install --prefix examples/vercel-ai-agent

pnpm run warrant -- scan --adaptive --rounds 1 -- node examples/vercel-ai-agent/agent.mjs "Summarize document doc-1"
pnpm run warrant -- guard --no-approval -- node examples/vercel-ai-agent/agent.mjs "Summarize document doc-1"
```

`pnpm run warrant` needs `--` before `scan` or `guard` so pnpm does not eat the flags. A scan exit code of 0 means every exploitable line was stopped and the normal summarize task still finished.
