"""Application settings, loaded from the .env file in the project root."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent      # project root (next to run.py)
load_dotenv(BASE_DIR / ".env")

FRONTEND_DIR = BASE_DIR / "frontend"


def _require(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise RuntimeError(f"Missing {name} in {BASE_DIR / '.env'}")
    return value.strip()


GROQ_API_KEY = _require("GROQ_API_KEY")
MODEL = _require("GROQ_MODEL")
TEMPERATURE = float(_require("GROQ_TEMPERATURE"))
MAX_TOKENS = int(_require("GROQ_MAX_TOKENS"))

SYSTEM_PROMPT = (
    "You are FlowAI, a helpful, concise AI assistant. "
    "Always reply in the same language the user writes in; "
    "if the user writes in English, reply in English. "
    "You have no internet access and no live data. For questions about specific "
    "local businesses, addresses, phone numbers, prices, news or anything recent, "
    "do not guess or invent details: say you are not sure, share only general "
    "knowledge you are confident about, and suggest checking Google Maps or the "
    "official website. "
    "Use Markdown for formatting and fenced code blocks for code."
)

# Guardrails so a client can't send unbounded payloads.
MAX_MESSAGES = 60
MAX_MESSAGE_CHARS = 16000