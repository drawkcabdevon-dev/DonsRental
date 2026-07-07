"""
Don's Rental — Cloud Run Backend
Proxies requests to Vertex AI Agent Engine.
"""

import json
import logging
import os
import re

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AGENT_ENGINE = os.environ.get("AGENT_ENGINE", "")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

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

class BookingRequest(BaseModel):
    vehicleId: str = ""
    customerName: str = ""
    customerEmail: str = ""
    customerPhone: str = ""
    customerAddress: str = ""
    pickupDate: str = ""
    pickupTime: str = ""
    returnDate: str = ""
    returnTime: str = ""
    dropoffLocation: str = ""
    licenseNumber: str = ""
    licenseExpiry: str = ""
    licenseIssuer: str = ""
    licenseClass: str = ""
    totalDays: int = 1
    totalCost: float = 0

MDS_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"

def _get_token() -> str:
    import requests as rq
    resp = rq.get(
        MDS_URL,
        headers={"Metadata-Flavor": "Google"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

def _extract_booking_ref(text: str) -> str:
    m = re.search(r'(BK[-:][A-Z0-9]+)', text, re.I)
    return m.group(1).upper() if m else ""

async def _query_agent(message: str) -> str:
    if not AGENT_ENGINE:
        raise HTTPException(503, "Agent Engine not configured (set AGENT_ENGINE env var)")

    token = _get_token()
    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1/{AGENT_ENGINE}:streamQuery"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {"input": {"message": message, "user_id": "web-user"}}

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=body, headers=headers) as resp:
            if resp.status_code != 200:
                text = await resp.aread()
                raise HTTPException(502, f"Agent Engine error ({resp.status_code}): {text.decode(errors='replace')[:500]}")

            parts = []
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if "error_code" in chunk:
                    logger.warning("Agent error: %s - %s", chunk.get("error_code"), chunk.get("error_message"))
                    continue
                content = chunk.get("content") or {}
                for p in content.get("parts", []):
                    if "text" in p:
                        parts.append(p["text"])
            return " ".join(parts)

@app.post("/api/chat")
async def chat(req: ChatRequest):
    logger.info("Sending to agent: %s", req.message[:100])
    try:
        text = await _query_agent(req.message)
        ref = _extract_booking_ref(text)
        logger.info("Agent response (len=%d, ref=%s)", len(text), ref or "none")
        return ChatResponse(response=text, booking_ref=ref)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Agent query failed: %s", e)
        raise HTTPException(502, f"Agent error: {e}")

@app.get("/api/health")
async def health():
    return {"status": "ok", "engine_configured": bool(AGENT_ENGINE)}

VEHICLES = [
    {
        "id": "v1",
        "name": "Standard Rental Car",
        "rate": 120,
        "seats": 5,
        "transmission": "automatic",
        "fuelType": "petrol",
        "description": "Clean, reliable car for getting around Barbados. 2-day minimum. Weekend & weekly specials available.",
        "imageUrl": "/dons-car.png",
        "features": ["Air Conditioning", "2-Day Minimum", "Weekend Specials", "Free Drop-off"],
    }
]

@app.get("/api/vehicles")
async def get_vehicles():
    return {"vehicles": VEHICLES}

@app.post("/api/bookings")
async def create_booking(req: BookingRequest):
    ref = "BK-" + os.urandom(4).hex().upper()
    logger.info("Booking created: %s by %s (%s)", ref, req.customerName, req.customerEmail)
    return {
        "success": True,
        "bookingId": ref,
        "vehicleId": req.vehicleId,
        "customerName": req.customerName,
        "totalDays": req.totalDays,
        "totalCost": req.totalCost,
    }

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
