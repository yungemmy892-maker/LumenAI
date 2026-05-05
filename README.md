# 🧠 AI Page Summarizer

A Chrome Extension + Django backend that uses AI to instantly summarize any webpage into:

* 📌 Bullet points
* 🔍 Key insights
* ⏱️ Reading time
* ✨ Highlights

Built with a scalable architecture using:

* Chrome Extension (Frontend)
* Django (Backend API)
* Gemini + Groq (AI providers)
* Render (Backend Hosting)
* Vercel (Frontend Hosting)

---

# 🚀 Features

* ⚡ One-click webpage summarization
* 🧠 AI-powered structured output
* 📦 Caching system (reduces API usage)
* 🚦 Rate limiting (client-side protection)
* 🔐 Secure API (no keys exposed in frontend)
* 🌍 Works on any website

---

# 🏗️ Project Structure

```
ai-page-summarizer/
│
├── extension/                 # Chrome Extension (Frontend)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── icons/
│   └── src/
│       ├── background.js
│       └── content.js
│
└── backend/                   # Django Backend (AI Engine)
    ├── manage.py
    ├── requirements.txt
    ├── .env
    ├── config/
    │   ├── settings.py
    │   └── urls.py
    └── api/
        ├── views.py
        └── services/
            └── ai_service.py
```

---

# ⚙️ Setup (Local Development)

## 1. Clone the repo

```
git clone https://github.com/YOUR_USERNAME/ai-page-summarizer.git
cd ai-page-summarizer
```

---

## 2. Backend Setup (Django)

```
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 3. Create `.env`

```
SECRET_KEY=your-secret-key
DEBUG=True

GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
```

---

## 4. Run server

```
python manage.py runserver
```

👉 Backend runs at:

```
http://localhost:8000
```

---

## 5. Load Chrome Extension

1. Go to:

```
chrome://extensions/
```

2. Enable:
   👉 Developer Mode

3. Click:
   👉 Load Unpacked

4. Select:

```
ai-page-summarizer/extension/
```

---

## 6. Update Backend URL

In:

```
extension/src/background.js
```

Set:

```js
const BACKEND_URL = "http://localhost:8000";
```

---

# 🌍 Deployment

---

## 🚀 Backend Deployment (Render)

### 1. Push to GitHub

```
git add .
git commit -m "initial deploy"
git push -u origin main
```

---

### 2. Create Web Service on Render

* Runtime: Python
* Root Directory: `backend`
* Build Command:

```
pip install -r requirements.txt
```

* Start Command:

```
gunicorn config.wsgi:application
```

---

### 3. Environment Variables

```
SECRET_KEY=your-secret
DEBUG=False
ALLOWED_HOSTS=.onrender.com

GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
```

---

### 4. Deploy

After deployment, your API will be:

```
https://your-app.onrender.com/api/summarize/
```

---

## 🌐 Frontend Hosting (Vercel)

### 1. Go to Vercel

* Import your repo
* Set root directory to:

```
extension
```

### 2. Deploy

You’ll get:

```
https://your-app.vercel.app
```

---

## 🔌 Connect Frontend to Backend

Update:

```js
const BACKEND_URL = "https://your-app.onrender.com";
```

---

# 🔐 Chrome Extension Permissions

Example:

```json
"permissions": [
  "activeTab",
  "storage",
  "scripting"
],
"host_permissions": [
  "https://your-app.onrender.com/*"
]
```

---

# 🧪 Testing

## 1. Test Backend

```
POST /api/summarize/
```

Example:

```json
{
  "content": "Some webpage text...",
  "url": "https://example.com"
}
```

---

## 2. Test Extension

* Open any article
* Click extension
* Click summarize

---

## 3. Debug

Go to:

```
chrome://extensions/
```

Click:

👉 Service Worker → Inspect

---

# ⚠️ Common Issues

### ❌ 1. Manifest not loading

👉 Load correct folder:

```
extension/
```

---

### ❌ 2. API not working

* Check backend URL
* Ensure CORS enabled

---

### ❌ 3. Render sleeping

* First request may be slow (10–30s)

---

### ❌ 4. Wrong host permissions

👉 Must include deployed backend URL

---

# 🧠 Architecture Overview

```
Chrome Extension
   ↓
Background Script
   ↓
Django API (Render)
   ↓
Gemini / Groq AI
   ↓
Response → Extension UI
```

---

# 💡 Future Improvements

* 🔐 User authentication (turn into SaaS)
* 📊 Usage analytics dashboard
* ⚡ Faster responses with caching layer
* 🧾 Save summaries history
* 🌐 Multi-language support

---

# 👨‍💻 Author

**Emmanuel Okon**

---

# 📄 License

MIT License

---

# ⭐ Support

If you found this useful:

* Star the repo ⭐
* Share with others 🚀
