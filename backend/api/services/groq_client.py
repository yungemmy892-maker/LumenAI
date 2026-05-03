"""
Groq Client — fallback AI provider.

Sole file responsible for all Groq SDK usage.
Raises GroqUnavailableError on any failure so the orchestrator
knows to surface the error after all providers are exhausted.
"""

import os
import json
import logging
from groq import Groq

logger = logging.getLogger(__name__)


class GroqUnavailableError(Exception):
    """Raised when Groq cannot fulfil the request for any reason."""


_client = None


def _get_client() -> Groq:
    global _client
    if _client is not None:
        return _client

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise GroqUnavailableError("GROQ_API_KEY is not set in .env")

    _client = Groq(api_key=api_key)
    return _client


def summarize(prompt: str) -> dict:
    """
    Send prompt to Groq (llama-3.3-70b-versatile) and return a parsed dict.

    Raises:
        GroqUnavailableError — key missing, quota hit, or any API error
        ValueError           — response is not valid JSON
    """
    try:
        client = _get_client()
        chat = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=1024,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert content analyst. When given webpage content, you produce "
                        "structured summaries that are clear, accurate, and genuinely useful. "
                        "Always respond with valid JSON only — no markdown, no code fences, no preamble."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        raw = chat.choices[0].message.content or ""
    except GroqUnavailableError:
        raise
    except Exception as exc:
        logger.warning("[Groq] API call failed: %s: %s", type(exc).__name__, exc)
        raise GroqUnavailableError(f"Groq call failed: {exc}") from exc

    return _parse(raw)


def _parse(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
    if cleaned.endswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[:-1])
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Groq returned invalid JSON: {exc} | Raw: {raw[:300]}") from exc
