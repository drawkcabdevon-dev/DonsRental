"""
Don's Rental — Cloud Run Backend
Proxies requests to Vertex AI Agent Engine.
"""

import os
import json
import re
import logging

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import vertexai
from vertexai import agent_engines

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AGENT_ENGINE = os.environ.get("AGENT_ENGINE", "")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

vertexai.init(project=PROJECT, location=LOCATION)

app = FastAPI(title="Don's Rental Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    booking_ref: str = ""

_remote = None

def _get_engine():
    global _remote
    if _remote is None and AGENT_ENGINE:
        _remote = agent_engines.get(AGENT_ENGINE)
    return _remote

def _extract_booking_ref(text: str) -> str:
    m = re.search(r'(BK[-:][A-Z0-9]+)', text, re.I)
    return m.group(1).upper() if m else ""

def _flatten_events(result):
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        content = result.get("content") or result.get("response") or result.get("output", "")
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    for p in item.get("parts", []):
                        if isinstance(p, dict) and "text" in p:
                            parts.append(p["text"])
            return " ".join(parts)
        return str(content or json.dumps(result))
    return str(result)

@app.post("/api/chat")
async def chat(req: ChatRequest):
    engine = _get_engine()
    if not engine:
        raise HTTPException(503, "Agent Engine not configured (set AGENT_ENGINE env var)")

    logger.info("Sending to agent: %s", req.message[:100])
    try:
        result = engine.query(input=req.message)
        text = _flatten_events(result)
        ref = _extract_booking_ref(text)
        logger.info("Agent response (len=%d, ref=%s)", len(text), ref or "none")
        return ChatResponse(response=text, booking_ref=ref)
    except Exception as e:
        logger.error("Agent query failed: %s", e)
        raise HTTPException(502, f"Agent error: {e}")

@app.get("/api/health")
async def health():
    return {"status": "ok", "engine_configured": bool(AGENT_ENGINE)}

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
