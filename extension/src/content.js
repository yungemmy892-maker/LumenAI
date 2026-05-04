// Content Script - Runs in the context of web pages
// Responsible for: content extraction, highlight injection

(function () {
  "use strict";

  // ─── Content Extraction ───────────────────────────────────────────────────

  function extractPageContent() {
    const doc = document.cloneNode(true);

    // Remove noise elements
    const noiseSelectors = [
      "script", "style", "noscript", "iframe", "svg", "canvas",
      "nav", "header", "footer", "aside",
      "[role='navigation']", "[role='banner']", "[role='contentinfo']",
      "[role='complementary']", "[role='search']",
      ".nav", ".navbar", ".navigation", ".menu", ".sidebar", ".footer",
      ".header", ".advertisement", ".ad", ".ads", ".cookie-banner",
      ".popup", ".modal", ".overlay", "#cookie", "#nav", "#header",
      "#footer", "#sidebar", ".social-share", ".related-posts",
      ".comments", "#comments", ".comment-section",
    ];

    noiseSelectors.forEach((sel) => {
      try {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      } catch (_) {}
    });

    // Priority content selectors (ordered best → fallback)
    const contentSelectors = [
      "article",
      "[role='main']",
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".article-body",
      ".post-body",
      ".story-body",
      ".content-body",
      "#article-body",
      "#main-content",
      "#content",
      ".content",
      ".markdown-body",   // GitHub
      ".prose",           // Tailwind prose
      "[itemprop='articleBody']",
    ];

    let bestElement = null;

    for (const sel of contentSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        bestElement = el;
        break;
      }
    }

    // Heuristic fallback: find the div with the most text
    if (!bestElement) {
      const candidates = Array.from(doc.querySelectorAll("div, section"))
        .filter((el) => {
          const text = el.innerText || "";
          return text.length > 500 && el.querySelectorAll("p").length >= 2;
        })
        .sort((a, b) => {
          const aText = (a.innerText || "").length;
          const bText = (b.innerText || "").length;
          return bText - aText;
        });

      bestElement = candidates[0] || doc.body;
    }

    // Extract and clean text
    let text = bestElement ? (bestElement.innerText || bestElement.textContent || "") : "";

    // Clean up whitespace
    text = text
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      text,
      title: document.title || "",
      url: window.location.href,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  }

  // ─── Highlight Injection ──────────────────────────────────────────────────

  let activeHighlights = [];
  let highlightStyleEl = null;

  function injectHighlightStyles() {
    if (highlightStyleEl) return;
    highlightStyleEl = document.createElement("style");
    highlightStyleEl.id = "ai-summarizer-styles";
    highlightStyleEl.textContent = `
      .ai-summarizer-highlight {
        background: linear-gradient(120deg, rgba(255, 214, 0, 0.45) 0%, rgba(255, 180, 0, 0.35) 100%);
        border-radius: 3px;
        padding: 1px 2px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
        transition: background 0.2s ease;
        cursor: pointer;
        position: relative;
      }
      .ai-summarizer-highlight:hover {
        background: linear-gradient(120deg, rgba(255, 214, 0, 0.75) 0%, rgba(255, 160, 0, 0.6) 100%);
      }
      .ai-summarizer-highlight-pulse {
        animation: aiHighlightPulse 1.2s ease-out;
      }
      @keyframes aiHighlightPulse {
        0% { background: linear-gradient(120deg, rgba(255, 214, 0, 0.9) 0%, rgba(255, 140, 0, 0.85) 100%); }
        100% { background: linear-gradient(120deg, rgba(255, 214, 0, 0.45) 0%, rgba(255, 180, 0, 0.35) 100%); }
      }
    `;
    document.head.appendChild(highlightStyleEl);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightTextInNode(node, phrase) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const regex = new RegExp(`(${escapeRegex(phrase)})`, "gi");
      if (!regex.test(text)) return false;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
        }
        const mark = document.createElement("mark");
        mark.className = "ai-summarizer-highlight ai-summarizer-highlight-pulse";
        mark.textContent = match[1];
        frag.appendChild(mark);
        activeHighlights.push(mark);
        lastIdx = regex.lastIndex;
      }

      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }

      node.parentNode.replaceChild(frag, node);
      return true;
    }

    if (
      node.nodeType === Node.ELEMENT_NODE &&
      !["SCRIPT", "STYLE", "MARK", "TEXTAREA", "INPUT"].includes(node.tagName)
    ) {
      let found = false;
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (highlightTextInNode(child, phrase)) found = true;
      }
      return found;
    }

    return false;
  }

  function applyHighlights(phrases) {
    injectHighlightStyles();
    removeHighlights();

    const mainContent =
      document.querySelector("article, [role='main'], main, .post-content, .article-content, #content, body");

    phrases.forEach((phrase) => {
      if (!phrase || phrase.length < 4) return;
      try {
        highlightTextInNode(mainContent || document.body, phrase);
      } catch (_) {}
    });

    // Scroll to first highlight
    if (activeHighlights.length > 0) {
      activeHighlights[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return activeHighlights.length;
  }

  function removeHighlights() {
    activeHighlights.forEach((mark) => {
      if (mark.parentNode) {
        const text = document.createTextNode(mark.textContent);
        mark.parentNode.replaceChild(text, mark);
      }
    });
    // Normalize merged text nodes
    document.body.normalize();
    activeHighlights = [];
  }

  // ─── Message Listener ─────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_CONTENT") {
      try {
        const content = extractPageContent();
        sendResponse({ success: true, data: content });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === "APPLY_HIGHLIGHTS") {
      try {
        const count = applyHighlights(message.phrases || []);
        sendResponse({ success: true, count });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === "REMOVE_HIGHLIGHTS") {
      try {
        removeHighlights();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
  });
})();
