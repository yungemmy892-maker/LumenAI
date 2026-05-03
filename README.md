# 🔍 LumenAI — AI Page Summarizer

A Chrome Extension + Django backend in one folder. The extension extracts page content and sends it to the local Django server, which holds your Anthropic API key and calls the AI. The key never touches the browser.

---

## ✨ Features

- **Smart content extraction** — heuristic-based readability parser strips navbars, footers, ads, and sidebar noise
- **Structured AI summaries** — bullet-point key points, key insights, reading time, and word count
- **In-page highlighting** — highlight important phrases directly on the webpage
- **Per-URL caching** — summaries cached for 30 minutes to avoid redundant API calls
- **Dark/light mode** — persistent theme preference
- **Configurable** — choose summary length (3 / 5 / 8 bullets) and tone (concise / detailed / simple)
- **Rate limiting** — max 10 requests/minute to prevent accidental overuse
- **Copy to clipboard** — one-click copy of the full summary

---

## 📁 Project Structure

```
ai-page-summarizer/
│
├── 📦 EXTENSION (load this whole folder into Chrome)
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── src/
│   ├── background.js      ← calls Django at localhost:8000
│   └── content.js         ← extracts page text + highlights
│
└── 🖥️  BACKEND (run this to power the AI)
    backend/
    ├── manage.py
    ├── requirements.txt
    ├── .env                ← YOUR API KEY GOES HERE
    ├── config/
    │   ├── settings.py
    │   └── urls.py
    └── api/
        ├── views.py
        ├── urls.py
        └── services/
            └── ai_service.py   ← only file that touches the API key
```

---

## 🚀 Setup (do this once)

1. **Download / clone** this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-page-summarizer.git
   ```
   Or download and unzip the ZIP file.
---

### Step 2 — Set up the Backend

Open a terminal and `cd` into the `backend` folder inside the project:

```bash
cd ai-page-summarizer/backend
```

Create and activate a virtual environment:

```bash
# Mac / Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Add your Anthropic API key to `.env`:

```bash
# Open backend/.env in any text editor and fill in:
SECRET_KEY=any-long-random-string-for-django
ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

> Get your key at: https://console.anthropic.com/settings/keys

Start the Django server:

```bash
python manage.py runserver
```

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

**Leave this terminal running** while you use the extension.

---

### Step 3 — Install the Extension

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the **`ai-page-summarizer` folder** — the root one containing `manifest.json`
5. Click the 🧩 puzzle icon in Chrome toolbar → pin **LumenAI**

---

### Step 4 — Summarize a Page

1. Navigate to any article or blog post
2. Click the **LumenAI icon** in the toolbar
3. Click **"Summarize Page"**
4. Done — the extension sends the content to your local Django server, which calls Anthropic and returns a structured summary

---

## 🔄 How They're Connected

```
Chrome Extension
    └── src/background.js
            └── POST http://localhost:8000/api/summarize/
                    └── backend/api/views.py
                            └── backend/api/services/ai_service.py
                                    └── Gemini API (key from .env)
```

The extension only ever sends extracted page **text** to your backend.
Your API key lives only in `backend/.env` — never in the browser.

---

## 🔁 Daily Use

Every time you want to use the extension, start the backend first:

```bash
cd ai-page-summarizer/backend
source venv/bin/activate        # Windows: venv\Scripts\activate
python manage.py runserver
```

Then use the extension normally in Chrome.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach the backend" | Make sure `python manage.py runserver` is running |
| "AI service unavailable" | Check that `GEMINI_API_KEY` is set in `backend/.env` |
| Extension not loading | Make sure you selected the root `ai-page-summarizer/` folder (containing `manifest.json`), not the `backend/` subfolder |
| Changes not reflecting | Go to `chrome://extensions` → click the refresh icon on LumenAI |
| "Cannot access this page" | Extension can't run on `chrome://` pages or PDFs — try any regular `https://` article |

---

## 🔒 Security Notes

- API key is stored only in `backend/.env` — never committed to git (add `.env` to `.gitignore`)
- The extension has no access to the key at any point
- CORS is open (`*`) in development mode — lock it down before deploying publicly
