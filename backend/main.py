"""FlowAI backend: streams chat replies from one Groq model."""
import json
import logging
from typing import AsyncIterator, Literal

from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from groq import APIError, AsyncGroq
from pydantic import BaseModel, Field

from . import config

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("flowai")

app = FastAPI(title="FlowAI")
client = AsyncGroq(api_key=config.GROQ_API_KEY)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=config.MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=config.MAX_MESSAGES)


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/api/health")
async def health():
    return {"status": "ok", "api_key_configured": True, "model": config.MODEL}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    messages = [{"role": "system", "content": config.SYSTEM_PROMPT}]
    messages += [m.model_dump() for m in req.messages]

    async def event_stream() -> AsyncIterator[str]:
        try:
            stream = await client.chat.completions.create(
                model=config.MODEL,
                messages=messages,
                temperature=config.TEMPERATURE,
                max_tokens=config.MAX_TOKENS,
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content
                if delta:
                    yield sse({"token": delta})
            yield sse({"done": True})
        except APIError as exc:
            log.error("Groq API error: %s", exc)
            yield sse({"error": getattr(exc, "message", str(exc))})
        except Exception as exc:  # noqa: BLE001
            log.exception("Unexpected error while streaming")
            yield sse({"error": f"Unexpected error: {exc}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- Frontend (static files) ----
app.mount("/static", StaticFiles(directory=config.FRONTEND_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(config.FRONTEND_DIR / "index.html")