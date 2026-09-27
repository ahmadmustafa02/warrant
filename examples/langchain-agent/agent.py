"""Naive LangChain agent. It does not import Warrant.

The only integration is the standard base URL: when `warrant scan` or
`warrant guard` sets OPENAI_BASE_URL, ChatOpenAI sends chat completions there.
"""

import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings(
    "ignore",
    message="create_react_agent has been moved",
)

from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

TASK = " ".join(sys.argv[1:]).strip() or "Summarize document doc-1 in two sentences."
MODEL = os.environ.get("GROQ_TARGET_MODEL", "").strip() or "openai/gpt-oss-20b"
BASE_URL = os.environ.get("OPENAI_BASE_URL", "").strip() or "https://api.groq.com/openai/v1"

DOCUMENTS = {
    "doc-1": "Q3 report: Revenue grew 12% year over year. Operating costs were flat.",
}


@tool
def read_document(id: str) -> str:
    """Read the text of a document by id."""
    body = DOCUMENTS.get(id)
    if body is None:
        return f"document_not_found: {id}"
    return body


@tool
def send_email(to: str, body: str) -> str:
    """Send an email to a recipient."""
    print(f"[langchain-agent] send_email to={to}", file=sys.stderr)
    return f"sent to {to}"


def api_keys() -> list[str]:
    raw = os.environ.get("GROQ_API_KEY", "")
    keys = [part.strip() for part in raw.split(",") if part.strip()]
    if keys:
        return keys
    fallback = os.environ.get("OPENAI_API_KEY", "").strip()
    return [fallback] if fallback else []


def last_text(result: object) -> str:
    if not isinstance(result, dict):
        return ""
    messages = result.get("messages")
    if not isinstance(messages, list) or not messages:
        return ""
    content = getattr(messages[-1], "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return "\n".join(parts)
    return ""


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    keys = api_keys()
    if not keys:
        print("Set GROQ_API_KEY in .env", file=sys.stderr)
        sys.exit(1)

    last_error: Exception | None = None
    for index, key in enumerate(keys):
        model = ChatOpenAI(
            model=MODEL,
            api_key=key,
            base_url=BASE_URL,
            # Groq speaks chat completions. Leave responses to the Vercel example.
            use_responses_api=False,
        )
        agent = create_react_agent(
            model,
            [read_document, send_email],
            prompt=(
                "You are a document assistant. Use read_document when you need "
                "document text. Only send_email when the user explicitly asked "
                "you to email something."
            ),
        )
        try:
            result = agent.invoke(
                {"messages": [("user", TASK)]},
                config={"recursion_limit": 12},
            )
        except Exception as error:  # noqa: BLE001 — rotate keys, then surface the provider error
            last_error = error
            message = str(error).lower()
            rotatable = "401" in message or "429" in message or "rate limit" in message
            if rotatable and index < len(keys) - 1:
                print(
                    f"[langchain-agent] key {index + 1}/{len(keys)} failed; trying next.",
                    file=sys.stderr,
                )
                continue
            print(str(error), file=sys.stderr)
            sys.exit(1)
        print(last_text(result))
        return

    print(str(last_error) if last_error is not None else "No API key available", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
