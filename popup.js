// Popup Script - UI logic, state management, message passing to background.js

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  let currentSummary = null;
  let currentUrl     = null;
  let currentTabId   = null;
  let highlightsActive = false;
  let isDark = true;

  // ─── DOM Refs ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const els = {
    // Header
    settingsBtn:      $('settingsBtn'),
    themeBtn:         $('themeBtn'),
    moonIcon:         $('moonIcon'),
    sunIcon:          $('sunIcon'),
    // Panels
    settingsPanel:    $('settingsPanel'),
    mainPanel:        $('mainPanel'),
    // Page info
    pageTitle:        $('pageTitle'),
    pageFavicon:      $('pageFavicon'),
    // States
    setupNeeded:      $('setupNeeded'),
    setupMsg:         $('setupMsg'),
    idleState:        $('idleState'),
    loadingState:     $('loadingState'),
    errorState:       $('errorState'),
    summaryState:     $('summaryState'),
    // Loading
    loadingMsg:       $('loadingMsg'),
    loadingBarFill:   $('loadingBarFill'),
    // Error
    errorMsg:         $('errorMsg'),
    retryBtn:         $('retryBtn'),
    retryConnectBtn:  $('retryConnectBtn'),
    // Summary
    contentTypeBadge: $('contentTypeBadge'),
    readingTime:      $('readingTime'),
    wordCount:        $('wordCount'),
    cacheBadge:       $('cacheBadge'),
    summaryText:      $('summaryText'),
    bulletList:       $('bulletList'),
    insightList:      $('insightList'),
    // Actions
    summarizeBtn:     $('summarizeBtn'),
    highlightBtn:     $('highlightBtn'),
    copyBtn:          $('copyBtn'),
    clearBtn:         $('clearBtn'),
    // Settings
    saveSettingsBtn:  $('saveSettingsBtn'),
    clearCacheBtn:    $('clearCacheBtn'),
    settingsMsg:      $('settingsMsg'),
  };

  // ─── State Machine ────────────────────────────────────────────────────────
  function showState(name) {
    ['setupNeeded','idleState','loadingState','errorState','summaryState'].forEach((s) => {
      els[s]?.classList.toggle('hidden', s !== name);
    });
  }

  function setLoadingProgress(pct, msg) {
    els.loadingBarFill.style.width = pct + '%';
    if (msg) els.loadingMsg.textContent = msg;
  }

  function setError(msg) {
    els.errorMsg.textContent = msg;
    showState('errorState');
  }

  // ─── Settings Panel ───────────────────────────────────────────────────────
  function toggleSettings() {
    const isOpen = !els.settingsPanel.classList.contains('hidden');
    els.settingsPanel.classList.toggle('hidden', isOpen);
    els.mainPanel.classList.toggle('hidden', !isOpen);
    if (!isOpen) loadSettingsUI();
  }

  els.settingsBtn.addEventListener('click', toggleSettings);

  // ─── Theme ────────────────────────────────────────────────────────────────
  function applyTheme(dark) {
    isDark = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    els.moonIcon.style.display = dark ? 'block' : 'none';
    els.sunIcon.style.display  = dark ? 'none'  : 'block';
    chrome.storage.local.set({ darkMode: dark });
  }

  els.themeBtn.addEventListener('click', () => applyTheme(!isDark));

  // ─── Save Settings ────────────────────────────────────────────────────────
  els.saveSettingsBtn.addEventListener('click', async () => {
    const bulletCount = parseInt(
      document.querySelector('input[name="bulletCount"]:checked')?.value || '5'
    );
    const tone = document.querySelector('input[name="tone"]:checked')?.value || 'concise';

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { bulletCount, tone },
    });

    if (response.success) {
      showSettingsMsg('Settings saved ✓', 'success');
      setTimeout(toggleSettings, 900);
    } else {
      showSettingsMsg(response.error, 'error');
    }
  });

  // ─── Clear Cache ──────────────────────────────────────────────────────────
  els.clearCacheBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    showSettingsMsg(response.success ? 'Cache cleared ✓' : 'Error clearing cache', response.success ? 'success' : 'error');
  });

  function showSettingsMsg(text, type) {
    els.settingsMsg.textContent = text;
    els.settingsMsg.className = 'settings-msg ' + (type || '');
    setTimeout(() => { els.settingsMsg.textContent = ''; els.settingsMsg.className = 'settings-msg'; }, 2500);
  }

  async function loadSettingsUI() {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const s = res.settings || {};
    if (s.bulletCount) {
      const r = document.querySelector(`input[name="bulletCount"][value="${s.bulletCount}"]`);
      if (r) r.checked = true;
    }
    if (s.tone) {
      const r = document.querySelector(`input[name="tone"][value="${s.tone}"]`);
      if (r) r.checked = true;
    }
  }

  // ─── Init Main Panel ──────────────────────────────────────────────────────
  async function initMain() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { setError('Cannot access current tab.'); return; }

    currentTabId = tab.id;
    currentUrl   = tab.url;

    // Page title
    els.pageTitle.textContent = tab.title || tab.url;

    // Favicon
    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=16`;
    img.onerror = () => { els.pageFavicon.style.background = 'var(--accent-dim)'; };
    els.pageFavicon.appendChild(img);

    // Theme
    const result = await chrome.storage.local.get(['darkMode']);
    applyTheme(result.darkMode !== false);

    showState('idleState');
  }

  // ─── Summarize Flow ───────────────────────────────────────────────────────
  async function summarize() {
    showState('loadingState');
    setLoadingProgress(10, 'Extracting content…');

    try {
      // 1. Extract content via content script
      let extractResult;
      try {
        extractResult = await chrome.tabs.sendMessage(currentTabId, { type: 'EXTRACT_CONTENT' });
      } catch {
        throw new Error('Cannot access this page. Try a regular https:// webpage.');
      }

      if (!extractResult?.success) throw new Error(extractResult?.error || 'Failed to extract content.');

      setLoadingProgress(35, 'Sending to server…');

      // 2. Get current options
      const settingsRes = await chrome.storage.local.get(['settings']);
      const options = settingsRes.settings || { bulletCount: 5, tone: 'concise' };

      setLoadingProgress(55, 'Generating summary…');

      // 3. Send to background → Django backend
      const response = await chrome.runtime.sendMessage({
        type: 'SUMMARIZE_PAGE',
        url: currentUrl,
        content: extractResult.data.text,
        options,
      });

      setLoadingProgress(90, 'Rendering…');

      if (!response.success) {
        // Backend unreachable
        if (response.error?.includes('Cannot reach')) {
          els.setupMsg.textContent = response.error;
          showState('setupNeeded');
          return;
        }
        throw new Error(response.error);
      }

      setLoadingProgress(100, 'Done!');
      await delay(180);
      currentSummary = response.data;
      renderSummary(response.data, response.fromCache);

    } catch (err) {
      setError(err.message);
    }
  }

  // ─── Render Summary ───────────────────────────────────────────────────────
  function renderSummary(data, fromCache) {
    els.contentTypeBadge.textContent = data.contentType || 'article';
    els.readingTime.textContent = data.readingTimeMinutes || '?';
    els.wordCount.textContent = (data.wordCount || 0).toLocaleString();
    els.cacheBadge.classList.toggle('hidden', !fromCache);

    els.summaryText.textContent = sanitize(data.summary || '');

    els.bulletList.innerHTML = '';
    (data.bullets || []).forEach((b, i) => {
      const li = document.createElement('li');
      li.textContent = sanitize(b);
      li.style.animationDelay = (i * 50) + 'ms';
      els.bulletList.appendChild(li);
    });

    els.insightList.innerHTML = '';
    (data.keyInsights || []).forEach((ins) => {
      const li = document.createElement('li');
      li.textContent = sanitize(ins);
      els.insightList.appendChild(li);
    });

    showState('summaryState');
  }

  function sanitize(str) {
    return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Button Handlers ──────────────────────────────────────────────────────
  els.summarizeBtn.addEventListener('click', summarize);
  els.retryBtn.addEventListener('click', summarize);
  els.retryConnectBtn.addEventListener('click', summarize);

  els.clearBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE', url: currentUrl });
    if (highlightsActive) {
      try { await chrome.tabs.sendMessage(currentTabId, { type: 'REMOVE_HIGHLIGHTS' }); } catch {}
      highlightsActive = false;
    }
    currentSummary = null;
    showState('idleState');
  });

  els.highlightBtn.addEventListener('click', async () => {
    if (!currentSummary?.highlights?.length) return;

    if (highlightsActive) {
      try { await chrome.tabs.sendMessage(currentTabId, { type: 'REMOVE_HIGHLIGHTS' }); } catch {}
      highlightsActive = false;
      els.highlightBtn.innerHTML = highlightBtnHTML('Highlight');
    } else {
      try {
        await chrome.tabs.sendMessage(currentTabId, {
          type: 'APPLY_HIGHLIGHTS',
          phrases: currentSummary.highlights,
        });
        highlightsActive = true;
        els.highlightBtn.innerHTML = highlightBtnHTML('Remove');
      } catch {}
    }
  });

  function highlightBtnHTML(label) {
    return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2 10l2-2 5-5 1 1-5 5-2 2H2v-1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M8 3l1 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>${label}`;
  }

  els.copyBtn.addEventListener('click', async () => {
    if (!currentSummary) return;
    const text = [
      `Summary: ${currentSummary.summary}`,
      '',
      'Key Points:',
      ...(currentSummary.bullets || []).map((b) => `• ${b}`),
      '',
      'Key Insights:',
      ...(currentSummary.keyInsights || []).map((i) => `→ ${i}`),
      '',
      `[${currentSummary.readingTimeMinutes} min read · ${currentSummary.wordCount} words · ${currentSummary.contentType}]`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      const orig = els.copyBtn.innerHTML;
      els.copyBtn.textContent = 'Copied ✓';
      els.copyBtn.style.color = 'var(--accent)';
      setTimeout(() => { els.copyBtn.innerHTML = orig; els.copyBtn.style.color = ''; }, 1500);
    } catch {}
  });

  // ─── Utilities ────────────────────────────────────────────────────────────
  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  initMain();
})();
