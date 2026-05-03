"""
API Views — thin HTTP layer.

Responsibilities:
  - Validate incoming request shape
  - Delegate all AI work to ai_service
  - Return clean JSON responses
  - Map exceptions to appropriate HTTP status codes

The Gemini API key never appears here.
"""

import json
import logging

from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from api.services.ai_service import summarize_content

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class SummarizeView(View):
    """
    POST /api/summarize/

    Request body (JSON):
    {
        "content":      str,   required — extracted page text
        "url":          str,   optional — page URL (for logging)
        "bullet_count": int,   optional — default 5
        "tone":         str    optional — "concise" | "detailed" | "simple"
    }

    Response (JSON):
    {
        "title":               str,
        "summary":             str,
        "bullets":             [str],
        "keyInsights":         [str],
        "readingTimeMinutes":  int,
        "wordCount":           int,
        "contentType":         str,
        "highlights":          [str]
    }
    """

    MAX_CONTENT_LENGTH = 50_000
    VALID_TONES = {"concise", "detailed", "simple"}

    def post(self, request):
        # ── Parse body ────────────────────────────────────────────────────────
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self._error("Request body must be valid JSON.", status=400)

        # ── Validate ──────────────────────────────────────────────────────────
        content = body.get("content", "").strip()
        if not content:
            return self._error("'content' field is required.", status=400)
        if len(content) < 100:
            return self._error("Content is too short to summarize (min 100 characters).", status=400)
        if len(content) > self.MAX_CONTENT_LENGTH:
            content = content[:self.MAX_CONTENT_LENGTH]

        url = str(body.get("url", ""))[:2048]

        try:
            bullet_count = int(body.get("bullet_count", 5))
            bullet_count = max(1, min(bullet_count, 10))
        except (TypeError, ValueError):
            bullet_count = 5

        tone = str(body.get("tone", "concise")).lower()
        if tone not in self.VALID_TONES:
            tone = "concise"

        # ── Call AI service ───────────────────────────────────────────────────
        try:
            result = summarize_content(
                content=content,
                url=url,
                bullet_count=bullet_count,
                tone=tone,
            )
        except EnvironmentError as exc:
            logger.critical("GEMINI_API_KEY not configured: %s", exc)
            return self._error(
                "Server configuration error: GEMINI_API_KEY is not set in .env",
                status=503,
            )
        except ValueError as exc:
            logger.error("AI response parsing failed: %s", exc)
            return self._error("AI returned an unexpected response. Please try again.", status=502)
        except Exception as exc:
            # Print full error to terminal for easy debugging
            print(f"[Gemini error] {type(exc).__name__}: {exc}")
            logger.exception("Unexpected error during summarization: %s", exc)

            msg = str(exc)
            if "API_KEY" in msg or "api key" in msg.lower():
                return self._error("Invalid Gemini API key. Check GEMINI_API_KEY in .env", status=503)
            if "quota" in msg.lower() or "429" in msg:
                return self._error("Gemini rate limit reached. Please wait a moment.", status=429)
            return self._error(f"AI service error: {msg}", status=502)

        logger.info("Summarized page: %s", url or "(no url)")
        return JsonResponse(result, status=200)

    def get(self, request):
        return JsonResponse({"status": "ok", "message": "AI Page Summarizer API — Gemini"})

    @staticmethod
    def _error(message: str, status: int = 400) -> JsonResponse:
        return JsonResponse({"error": message}, status=status)
