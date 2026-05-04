"""
API Views — thin HTTP layer.

Only imports from ai_service. Has no knowledge of Gemini or Groq directly.
"""

import json
import logging

from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from api.services.ai_service import summarize_content, AIServiceError

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class SummarizeView(View):
    MAX_CONTENT_LENGTH = 50_000
    VALID_TONES = {"concise", "detailed", "simple"}

    def post(self, request):
        # ── Parse ─────────────────────────────────────────────────────────────
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self._error("Request body must be valid JSON.", status=400)

        # ── Validate ──────────────────────────────────────────────────────────
        content = body.get("content", "").strip()
        if not content:
            return self._error("'content' field is required.", status=400)
        if len(content) < 100:
            return self._error("Content is too short to summarize (min 100 chars).", status=400)
        if len(content) > self.MAX_CONTENT_LENGTH:
            content = content[:self.MAX_CONTENT_LENGTH]

        url = str(body.get("url", ""))[:2048]

        try:
            bullet_count = max(1, min(int(body.get("bullet_count", 5)), 10))
        except (TypeError, ValueError):
            bullet_count = 5

        tone = str(body.get("tone", "concise")).lower()
        if tone not in self.VALID_TONES:
            tone = "concise"

        # ── Summarize ─────────────────────────────────────────────────────────
        try:
            result = summarize_content(
                content=content,
                url=url,
                bullet_count=bullet_count,
                tone=tone,
            )
        except AIServiceError as exc:
            # Both providers failed — log full details to terminal
            print(f"[AI] All providers failed:\n{exc}")
            logger.error("All AI providers failed: %s", exc)
            return self._error(
                "All AI providers are currently unavailable. "
                "Check that GEMINI_API_KEY and GROQ_API_KEY are set in .env",
                status=503,
            )
        except ValueError as exc:
            logger.error("AI response parsing failed: %s", exc)
            return self._error("AI returned an unexpected response. Please try again.", status=502)
        except Exception as exc:
            logger.exception("Unexpected error: %s", exc)
            return self._error(f"Unexpected server error: {exc}", status=500)

        provider = result.pop("_provider", "unknown")
        logger.info("Summarized via %s: %s", provider, url or "(no url)")
        return JsonResponse(result, status=200)

    def get(self, request):
        return JsonResponse({
            "status": "ok",
            "message": "AI Page Summarizer API",
            "providers": ["gemini (primary)", "groq (fallback)"],
        })

    @staticmethod
    def _error(message: str, status: int = 400) -> JsonResponse:
        return JsonResponse({"error": message}, status=status)
