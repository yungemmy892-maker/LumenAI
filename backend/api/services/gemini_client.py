"""
Gemini Client — primary AI provider.

Sole file responsible for all Google Gemini SDK usage.
Raises GeminiUnavailableError on any failure so the orchestrator
can cleanly fall through to the next provider.
"""

import os
import json
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class GeminiUnavailableError(Exception):
    """Raised when Gemini cannot fulfil the request for any reason."""


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiUnavailableError("GEMINI_API_KEY is not set in .env")

    _client = genai.Client(api_key=api_key)
    return _client


def summarize(prompt: str) -> dict:
    """
    Send prompt to Gemini and return a parsed dict.

    Raises:
        GeminiUnavailableError — key missing, quota hit, or any API error
        ValueError             — response is not valid JSON
    """
    try:
        client = _get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=1024,
                response_mime_type="application/json",
                system_instruction=(
                    "You are an expert content analyst. When given webpage content, you produce "
                    "structured summaries that are clear, accurate, and genuinely useful. "
                    "Always respond with valid JSON only — no markdown, no code fences, no preamble."
                ),
            ),
        )
        raw = response.text or ""
    except GeminiUnavailableError:
        raise
    except Exception as exc:
        logger.warning("[Gemini] API call failed: %s: %s", type(exc).__name__, exc)
        raise GeminiUnavailableError(f"Gemini call failed: {exc}") from exc

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
        raise ValueError(f"Gemini returned invalid JSON: {exc} | Raw: {raw[:300]}") from exc