"""
Don's Rental — Cloud Run Backend
Proxies requests to Vertex AI Agent Engine + license OCR via Gemini.
"""

import json
import logging
import os
import re
import base64
from datetime import datetime, date
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AGENT_ENGINE = os.environ.get("AGENT_ENGINE", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

app = FastAPI(title="Don's Rental Backend")

# ── In-memory booking store (resets on restart — swap for DB/Sheets in prod) ──
_bookings: list[dict] = []

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

class ScanLicenseRequest(BaseModel):
    image: str

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
        "imageUrl": "/vehicle.png",
        "features": ["Air Conditioning", "2-Day Minimum", "Weekend Specials", "Free Drop-off"],
    }
]

def _parse_date(d: str) -> Optional[date]:
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None

def _dates_overlap(a1: date, a2: date, b1: date, b2: date) -> bool:
    """Check if date range [a1, a2] overlaps with [b1, b2]."""
    return a1 <= b2 and b1 <= a2

def _log_booking_notification(req: BookingRequest, ref: str):
    """Log booking details so the owner can see who booked what."""
    logger.info("=" * 50)
    logger.info("🆕 NEW BOOKING: %s", ref)
    logger.info("   Name:     %s", req.customerName)
    logger.info("   Email:    %s", req.customerEmail)
    logger.info("   Phone:    %s", req.customerPhone)
    logger.info("   Vehicle:  %s (%s)", req.vehicleId, req.vehicleId)
    logger.info("   Pickup:   %s at %s", req.pickupDate, req.pickupTime)
    logger.info("   Return:   %s at %s", req.returnDate, req.returnTime)
    logger.info("   License:  %s (exp %s)", req.licenseNumber, req.licenseExpiry)
    logger.info("   Days:     %d", req.totalDays)
    logger.info("   Cost:     Bds$%.2f", req.totalCost)
    logger.info("=" * 50)

    # Write to a log file for persistence
    log_file = os.environ.get("BOOKING_LOG_FILE", "/tmp/bookings.log")
    try:
        with open(log_file, "a") as f:
            f.write(json.dumps({
                "ref": ref,
                "name": req.customerName,
                "email": req.customerEmail,
                "phone": req.customerPhone,
                "vehicle": req.vehicleId,
                "pickup": req.pickupDate,
                "pickupTime": req.pickupTime,
                "return": req.returnDate,
                "returnTime": req.returnTime,
                "license": req.licenseNumber,
                "days": req.totalDays,
                "cost": req.totalCost,
                "created": datetime.utcnow().isoformat(),
            }) + "\n")
    except Exception as e:
        logger.warning("Could not write booking log: %s", e)

@app.get("/api/vehicles")
async def get_vehicles():
    return {"vehicles": VEHICLES}

class CheckAvailabilityRequest(BaseModel):
    pickupDate: str
    returnDate: str
    vehicleId: str = "v1"

@app.post("/api/check-availability")
async def check_availability(req: CheckAvailabilityRequest):
    """Check if a vehicle is available for the requested date range."""
    pickup = _parse_date(req.pickupDate)
    return_d = _parse_date(req.returnDate)
    if not pickup or not return_d:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    conflicts = []
    for b in _bookings:
        bp = _parse_date(b.get("pickupDate", ""))
        br = _parse_date(b.get("returnDate", ""))
        if bp and br and b.get("vehicleId", "v1") == req.vehicleId:
            if _dates_overlap(pickup, return_d, bp, br):
                conflicts.append({
                    "existingRef": b.get("bookingId", ""),
                    "pickupDate": b.get("pickupDate"),
                    "returnDate": b.get("returnDate"),
                })

    return {
        "available": len(conflicts) == 0,
        "conflicts": conflicts,
        "pickupDate": req.pickupDate,
        "returnDate": req.returnDate,
    }

@app.post("/api/bookings")
async def create_booking(req: BookingRequest):
    ref = "BK-" + os.urandom(4).hex().upper()

    # Check availability before booking
    pickup = _parse_date(req.pickupDate)
    return_d = _parse_date(req.returnDate)
    if pickup and return_d:
        for b in _bookings:
            bp = _parse_date(b.get("pickupDate", ""))
            br = _parse_date(b.get("returnDate", ""))
            if bp and br and b.get("vehicleId", "v1") == req.vehicleId:
                if _dates_overlap(pickup, return_d, bp, br):
                    raise HTTPException(409, f"Vehicle not available for those dates. Conflict with booking {b.get('bookingId', '')}.")

    # Store booking
    booking = {
        "bookingId": ref,
        "vehicleId": req.vehicleId or "v1",
        "customerName": req.customerName,
        "customerEmail": req.customerEmail,
        "customerPhone": req.customerPhone,
        "pickupDate": req.pickupDate,
        "pickupTime": req.pickupTime,
        "returnDate": req.returnDate,
        "returnTime": req.returnTime,
        "licenseNumber": req.licenseNumber,
        "totalDays": req.totalDays,
        "totalCost": req.totalCost,
        "created": datetime.utcnow().isoformat(),
    }
    _bookings.append(booking)

    # Notify
    _log_booking_notification(req, ref)

    return {
        "success": True,
        "bookingId": ref,
        "vehicleId": req.vehicleId,
        "customerName": req.customerName,
        "totalDays": req.totalDays,
        "totalCost": req.totalCost,
    }

@app.get("/api/bookings")
async def list_bookings():
    """List all bookings (so the owner can see what's reserved)."""
    return {"bookings": _bookings}

@app.post("/api/scan-license")
async def scan_license(req: ScanLicenseRequest):
    """Extract Barbados driver's license fields from an image using Gemini."""
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    image_data = req.image
    # Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    # Validate base64
    try:
        base64.b64decode(image_data, validate=True)
    except Exception:
        return {"error": "Invalid base64 image data"}

    prompt = """Extract the following fields from this Barbados driver's license image.
Return ONLY valid JSON (no markdown, no backticks) with these exact keys:
  "customerName": full name on the license,
  "licenseNumber": the license/driver number,
  "licenseExpiry": expiration date,
  "licenseIssuer": issuing authority (e.g. 'Barbados Licensing Authority'),
  "licenseClass": license class/type,
  "customerAddress": address on the license.
If a field is not visible, set it to null."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/jpeg", "data": image_data}}
            ]
        }]
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=body)
            if resp.status_code != 200:
                logger.error("Gemini API error: %s - %s", resp.status_code, resp.text[:300])
                return {"error": f"Vision API error ({resp.status_code})"}

            result = resp.json()
            text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            # Strip markdown code fences
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            parsed = json.loads(text)
            logger.info("License scan result: name=%s license=%s", parsed.get("customerName"), parsed.get("licenseNumber"))
            return parsed
    except json.JSONDecodeError:
        return {"raw": text, "error": "Could not parse Gemini response as JSON"}
    except Exception as e:
        logger.error("License scan failed: %s", e)
        return {"error": str(e)}

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
