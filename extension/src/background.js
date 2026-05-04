// Background Service Worker
// All AI calls go through the Django backend — no API keys ever stored in the extension.

// ── Config ────────────────────────────────────────────────────────────────────
// Change BACKEND_URL to your deployed server address in production.
const BACKEND_URL = "https://your-app.onrender.com";
const SUMMARIZE_ENDPOINT = `${BACKEND_URL}/api/summarize/`;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Rate Limiting (client-side guard) ────────────────────────────────────────
const rateLimitState = { requests: [], maxRequests: 10, windowMs: 60 * 1000 };

function isRateLimited() {
  const now = Date.now();
  rateLimitState.requests = rateLimitState.requests.filter(
    (t) => now - t < rateLimitState.windowMs
  );
  if (rateLimitState.requests.length >= rateLimitState.maxRequests) return true;
  rateLimitState.requests.push(now);
  return false;
}

// ── Cache (chrome.storage) ────────────────────────────────────────────────────
async function getCachedSummary(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["summaryCache"], (result) => {
      const cache = result.summaryCache || {};
      const entry = cache[url];
      resolve(entry && Date.now() - entry.timestamp < CACHE_TTL_MS ? entry.data : null);
    });
  });
}

async function cacheSummary(url, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["summaryCache"], (result) => {
      const cache = result.summaryCache || {};
      const entries = Object.entries(cache);
      if (entries.length >= 50) {
        const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        delete cache[oldest[0]];
      }
      cache[url] = { data, timestamp: Date.now() };
      chrome.storage.local.set({ summaryCache: cache }, resolve);
    });
  });
}

// ── Backend Call ──────────────────────────────────────────────────────────────
async function callBackend(content, pageUrl, options = {}) {
  let response;
  try {
    response = await fetch(SUMMARIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        url: pageUrl,
        bullet_count: options.bulletCount || 5,
        tone: options.tone || "concise",
      }),
    });
  } catch {
    throw new Error(
      `Cannot reach the backend at ${BACKEND_URL}. Make sure the Django server is running.`
    );
  }

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try { errorMsg = (await response.json()).error || errorMsg; } catch {}
    if (response.status === 429) throw new Error("Rate limit reached on the server. Please wait.");
    if (response.status === 503) throw new Error("AI service unavailable. Check your backend .env.");
    throw new Error(errorMsg);
  }

  return await response.json();
}

// ── Message Router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUMMARIZE_PAGE")  { handleSummarize(message, sendResponse); return true; }
  if (message.type === "CLEAR_CACHE")     { handleClearCache(message.url, sendResponse); return true; }
  if (message.type === "GET_SETTINGS")    { handleGetSettings(sendResponse); return true; }
  if (message.type === "SAVE_SETTINGS")   { handleSaveSettings(message.settings, sendResponse); return true; }
});

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleSummarize(message, sendResponse) {
  try {
    const { url, content, options } = message;

    const cached = await getCachedSummary(url);
    if (cached) { sendResponse({ success: true, data: cached, fromCache: true }); return; }

    if (isRateLimited()) {
      sendResponse({ success: false, error: "Too many requests. Please wait a moment." });
      return;
    }

    if (!content || content.trim().length < 100) {
      sendResponse({ success: false, error: "Not enough content to summarize on this page." });
      return;
    }

    const summary = await callBackend(content, url, options);
    await cacheSummary(url, summary);
    sendResponse({ success: true, data: summary, fromCache: false });

  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleClearCache(url, sendResponse) {
  try {
    if (url) {
      const result = await new Promise((r) => chrome.storage.local.get(["summaryCache"], r));
      const cache = result.summaryCache || {};
      delete cache[url];
      await new Promise((r) => chrome.storage.local.set({ summaryCache: cache }, r));
    } else {
      await new Promise((r) => chrome.storage.local.remove(["summaryCache"], r));
    }
    sendResponse({ success: true });
  } catch (err) { sendResponse({ success: false, error: err.message }); }
}

async function handleGetSettings(sendResponse) {
  try {
    const result = await new Promise((r) => chrome.storage.local.get(["settings"], r));
    sendResponse({
      success: true,
      settings: result.settings || { bulletCount: 5, tone: "concise" },
    });
  } catch (err) { sendResponse({ success: false, error: err.message }); }
}

async function handleSaveSettings(settings, sendResponse) {
  try {
    await new Promise((r) => chrome.storage.local.set({ settings }, r));
    sendResponse({ success: true });
  } catch (err) { sendResponse({ success: false, error: err.message }); }
}
