"""
AI Service — orchestrator with Gemini → Groq fallback.

This is the only file views.py should ever import from.
It owns the prompt, the fallback chain, and the provider selection logic.
Neither views.py nor any other file touches Gemini or Groq directly.

Fallback chain:
    1. Gemini 1.5 Flash  (primary — fast, free tier)
    2. Groq / LLaMA 3.3  (fallback — kicks in if Gemini fails for any reason)
    3. Both failed       → raises AIServiceError with both failure reasons
"""

import logging
from api.services.gemini_client import summarize as gemini_summarize, GeminiUnavailableError
from api.services.groq_client   import summarize as groq_summarize,   GroqUnavailableError

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """All providers failed. Message contains details of each failure."""


def _build_prompt(content: str, bullet_count: int, tone: str) -> str:
    """Single shared prompt used by both providers."""
    return f"""Analyze this webpage content and return a JSON object with exactly these fields:

{{
  "title": "A clean, descriptive title for the page content",
  "summary": "2-3 sentence overview of the main topic and purpose",
  "bullets": ["bullet 1", "bullet 2", ...],
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "readingTimeMinutes": <integer>,
  "wordCount": <integer>,
  "contentType": "article|tutorial|news|documentation|product|other",
  "highlights": ["exact short phrase from content 1", "phrase 2", "phrase 3"]
}}

Rules:
- bullets: exactly {bullet_count} concise bullet points covering the main points
- keyInsights: 3 deeper observations or takeaways
- readingTimeMinutes: estimate based on ~200 words/minute for the ORIGINAL content
- wordCount: approximate word count of the original content
- highlights: 3-5 exact short phrases (4-8 words each) that appear verbatim in the content
- tone: {tone}

Webpage content:
---
{content[:8000]}
---"""


def summarize_content(
    content: str,
    url: str = "",
    bullet_count: int = 5,
    tone: str = "concise",
) -> dict:
    """
    Summarize page content using the best available AI provider.

    Returns a structured dict on success.
    Raises AIServiceError if all providers fail.
    """
    prompt = _build_prompt(content, bullet_count, tone)
    gemini_error = None
    groq_error   = None

    # ── 1. Try Gemini ─────────────────────────────────────────────────────────
    try:
        result = gemini_summarize(prompt)
        logger.info("[AI] Gemini succeeded for: %s", url or "(no url)")
        result["_provider"] = "gemini"
        return result
    except (GeminiUnavailableError, ValueError) as exc:
        gemini_error = str(exc)
        logger.warning("[AI] Gemini failed (%s), trying Groq fallback…", gemini_error)

    # ── 2. Fallback to Groq ───────────────────────────────────────────────────
    try:
        result = groq_summarize(prompt)
        logger.info("[AI] Groq fallback succeeded for: %s", url or "(no url)")
        result["_provider"] = "groq"
        return result
    except (GroqUnavailableError, ValueError) as exc:
        groq_error = str(exc)
        logger.error("[AI] Groq fallback also failed (%s)", groq_error)

    # ── 3. Both failed ────────────────────────────────────────────────────────
    raise AIServiceError(
        f"All AI providers failed.\n"
        f"  Gemini: {gemini_error}\n"
        f"  Groq:   {groq_error}"
    )
