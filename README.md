# FlowAI

A ChatGPT-style chat app powered by the [Groq API](https://console.groq.com). FastAPI backend with streaming responses, and a dependency-free HTML/CSS/JS frontend.

## Features

- ChatGPT-style interface: dark theme, centered composer, collapsible chat sidebar
- Real-time token streaming (Server-Sent Events)
- Multiple chats saved in your browser (localStorage)
- Markdown rendering with tables and code blocks (Copy button)
- Stop button to cancel a response mid-stream
- Responsive layout (works on mobile)

Model, temperature and token limits are set in `.env` (see below), not in the UI.

## Project structure

```
flowai/
├── backend/
│   ├── __init__.py
│   ├── config.py        # settings from .env
│   └── main.py          # FastAPI app: /api/chat, /api/models, /api/health
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── .gitignore
├── requirements.txt
├── run.py               # start the app: python run.py
└── README.md
```

## Setup

1. **Get a Groq API key** at https://console.groq.com/keys

2. **Create a virtual environment and install dependencies**

   ```bash
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure your key**

   ```bash
   cp .env.example .env            # Windows: copy .env.example .env
   ```

   Open `.env` and set `GROQ_API_KEY`.

4. **Run**

   ```bash
   python run.py
   ```

5. Open http://127.0.0.1:8000

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | – | Your Groq API key (required) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Default model |
| `GROQ_TEMPERATURE` | `0.7` | Default temperature |
| `GROQ_MAX_TOKENS` | `2048` | Max tokens per reply |

## API

- `GET /api/health` – status and whether a key is configured
- `GET /api/models` – available models and defaults
- `POST /api/chat` – body: `{messages: [{role, content}], model?, temperature?, max_tokens?, system_prompt?}`; streams `data: {"token": "..."}` events, then `data: {"done": true}`

## Notes

- Your API key stays on the server and is never sent to the browser.
- Model availability changes over time; the dropdown is populated from Groq's live model list.
- To deploy, run `HOST=0.0.0.0 PORT=8000 python run.py` behind a reverse proxy (disable response buffering for streaming).
