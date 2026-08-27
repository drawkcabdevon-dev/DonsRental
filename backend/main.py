"""
Don's Rental — Cloud Run Backend
Proxies requests to Vertex AI Agent Engine + license OCR via Gemini.
"""

import json
import logging
import os
import re
import base64
from datetime import datetime, date, timedelta
from typing import Optional
import uuid
import asyncio
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

# Load .env file in development (not available in Cloud Run)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'), override=True)

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from google.auth import default as google_default
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.cloud import storage as gcs_storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AGENT_ENGINE = os.environ.get("AGENT_ENGINE", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "")
GOOGLE_SHEETS_CREDENTIALS = os.environ.get("GOOGLE_SHEETS_CREDENTIALS", "")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "donsrental-license-photos")
GCS_PHOTOS_PREFIX = os.environ.get("GCS_PHOTOS_PREFIX", "license-photos")

# ── SMTP email config ──────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
COMPANY_NAME = os.environ.get("COMPANY_NAME", "Don's Rental")
COMPANY_EMAIL = os.environ.get("COMPANY_EMAIL", "bookings@donsrental.com")
COMPANY_PHONE = os.environ.get("COMPANY_PHONE", "+1 (246) 268-2842")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")

app = FastAPI(title="Don's Rental Backend")

# ── Thread pool for blocking I/O operations ────────────
_executor = ThreadPoolExecutor(max_workers=4)

# ── Google Sheets singleton ─────────────────────────────
_sheets_svc = None

def _get_sheets():
    global _sheets_svc
    if _sheets_svc:
        return _sheets_svc
    if GOOGLE_SHEETS_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(GOOGLE_SHEETS_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/spreadsheets'],
        )
    else:
        creds, _ = google_default(scopes=['https://www.googleapis.com/auth/spreadsheets'])
    _sheets_svc = build('sheets', 'v4', credentials=creds)
    return _sheets_svc

# ── Google Cloud Storage singleton ─────────────────────
_gcs_client = None

def _get_gcs():
    global _gcs_client
    if _gcs_client:
        return _gcs_client
    if GOOGLE_SHEETS_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(GOOGLE_SHEETS_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/cloud-platform'],
        )
        _gcs_client = gcs_storage.Client(credentials=creds)
    else:
        _gcs_client = gcs_storage.Client()
    return _gcs_client

# ── SMTP email helpers ─────────────────────────────────
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def _send_smtp(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP. Returns True on success."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{COMPANY_NAME} <{COMPANY_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            if SMTP_PORT != 25:
                server.starttls()
                server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(COMPANY_EMAIL, [to_email], msg.as_string())
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as e:
        logger.error("SMTP send failed to %s: %s", to_email, e)
        return False

def _esc(text: str) -> str:
    """Minimal HTML escape."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def _send_booking_confirmation(req, ref: str, total_cost: float, days: int):
    """Send confirmation email to customer and notification to owner."""
    name = _esc(req.customerName)
    email = req.customerEmail
    vehicle = _esc(req.vehicleId or "v1")
    pu_d = _esc(req.pickupDate)
    pu_t = _esc(req.pickupTime or "09:00")
    re_d = _esc(req.returnDate)
    re_t = _esc(req.returnTime or "17:00")

    # ── Customer confirmation ──
    customer_html = f'''<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;">
<div style="background:#0f3460;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
  <h2 style="margin:0;">{_esc(COMPANY_NAME)}</h2>
  <p style="margin:4px 0 0;opacity:.85;">Booking Confirmation</p>
</div>
<div style="padding:24px 32px;border:1px solid #e0e0e0;border-top:0;border-radius:0 0 12px 12px;">
  <p>Hi <strong>{name}</strong>,</p>
  <p>Your booking is confirmed!</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Reference</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;">{_esc(ref)}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Vehicle</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{vehicle}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Pick-up</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{pu_d} at {pu_t}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Return</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{re_d} at {re_t}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Duration</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{days} day{"s" if days > 1 else ""}</td></tr>
    <tr><td style="padding:8px 12px;color:#666;">Total Due</td>
        <td style="padding:8px 12px;font-size:1.15rem;font-weight:700;color:#0f3460;">${total_cost:.2f}</td></tr>
  </table>
  <p style="color:#555;">Pay when you pick up the vehicle. We accept cash and card.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#999;font-size:.85rem;">{_esc(COMPANY_NAME)} &bull; {_esc(COMPANY_PHONE)}</p>
</div></body></html>'''

    _send_smtp(
        COMPANY_EMAIL,
        f"Booking Confirmation — {_esc(COMPANY_NAME)} (Ref: {_esc(ref)})",
        customer_html,
    )

    # ── Owner notification (if different from COMPANY_EMAIL) ──
    if OWNER_EMAIL and OWNER_EMAIL.lower() != COMPANY_EMAIL.lower():
        owner_html = f'''<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;">
<div style="padding:24px 32px;border:1px solid #e0e0e0;border-radius:12px;">
  <h2 style="margin:0 0 16px;">New Booking</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#666;">Ref</td><td style="padding:6px 0;font-weight:700;">{_esc(ref)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Customer</td><td style="padding:6px 0;">{name} ({_esc(email)})</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">{_esc(req.customerPhone or "N/A")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Vehicle</td><td style="padding:6px 0;">{vehicle}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Dates</td><td style="padding:6px 0;">{pu_d} {pu_t} → {re_d} {re_t}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Total</td><td style="padding:6px 0;font-weight:700;">${total_cost:.2f}</td></tr>
  </table>
</div></body></html>'''
        _send_smtp(
            OWNER_EMAIL,
            f"New Booking: {req.customerName} — {vehicle} ({_esc(ref)})",
            owner_html,
        )

# ── Google Calendar singleton ─────────────────────────
_calendar_svc = None
CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "primary")

def _get_calendar():
    global _calendar_svc
    if _calendar_svc:
        return _calendar_svc
    if GOOGLE_SHEETS_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(GOOGLE_SHEETS_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/calendar'],
        )
    else:
        creds, _ = google_default(scopes=['https://www.googleapis.com/auth/calendar'])
    _calendar_svc = build('calendar', 'v3', credentials=creds)
    return _calendar_svc

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
    licensePhotoUrl: str = ""

    @field_validator("customerEmail")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if v and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("customerName")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Customer name is required")
        return v.strip()

    @field_validator("customerPhone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phone number is required")
        return v.strip()

    @field_validator("pickupDate", "returnDate")
    @classmethod
    def validate_date_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Date is required")
        return v

class ScanLicenseRequest(BaseModel):
    image: str
def _add_to_calendar(req: BookingRequest, ref: str):
    """Add a booking as an event to Google Calendar."""
    if not GOOGLE_SHEETS_CREDENTIALS:
        logger.info("No credentials configured — skipping calendar event")
        return None
    try:
        svc = _get_calendar()
        pickup_dt = f"{req.pickupDate}T{req.pickupTime or '09:00'}:00"
        return_dt = f"{req.returnDate}T{req.returnTime or '17:00'}:00"
        event = {
            'summary': f'{ref} — {req.customerName}',
            'description': (
                f'Booking: {ref}\n'
                f'Customer: {req.customerName}\n'
                f'Email: {req.customerEmail}\n'
                f'Phone: {req.customerPhone}\n'
                f'Vehicle: {req.vehicleId}\n'
                f'License: {req.licenseNumber}\n'
                f'Days: {req.totalDays} | Total: Bds${req.totalCost}'
            ),
            'visibility': 'private',
            'start': {
                'dateTime': pickup_dt,
                'timeZone': 'America/Barbados',
            },
            'end': {
                'dateTime': return_dt,
                'timeZone': 'America/Barbados',
            },
        }
        created = svc.events().insert(calendarId=CALENDAR_ID, body=event).execute()
        logger.info("Calendar event created: %s", created.get('htmlLink'))
        return created.get('id')
    except Exception as e:
        logger.warning("Calendar event failed: %s", e)
        return None

def _upload_to_gcs(image_base64: str, booking_ref: str = "") -> str:
    """Upload a base64-encoded image to GCS and return its blob path (private object key)."""
    # Parse data URL and extract base64 data
    content_type = "image/jpeg"
    if "," in image_base64:
        header, image_base64 = image_base64.split(",", 1)
        # Only accept explicit JPEG data URLs
        if "data:" in header and "image/" in header:
            if "image/jpeg" not in header and "image/jpg" not in header:
                raise ValueError("Only JPEG images are supported")
            content_type = "image/jpeg"

    # Validate and decode base64
    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}")

    # Enforce maximum image size (5 MB)
    MAX_IMAGE_SIZE = 5 * 1024 * 1024
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise ValueError(f"Image too large: {len(image_bytes)} bytes (max {MAX_IMAGE_SIZE})")

    blob_name = f"{GCS_PHOTOS_PREFIX}/{booking_ref or 'pending'}-{uuid.uuid4().hex[:8]}.jpg"
    try:
        client = _get_gcs()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(blob_name)
        # Add explicit timeout to upload operation (30 seconds)
        blob.upload_from_string(image_bytes, content_type=content_type, timeout=30)
        # Return a signed URL (7 days) so the link in Sheets is viewable
        url = blob.generate_signed_url(expiration=timedelta(days=7), method="GET")
        logger.info("Photo uploaded to GCS: %s", blob_name)
        return url
    except Exception as e:
        logger.error("GCS upload failed: %s", e)
        raise

# ── In-memory booking store (backed by Google Sheets in prod) ──
_bookings: list[dict] = []  # Deprecated — Sheet is source of truth

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rentals.onlineverywhere.com",
        "https://donsrental-wof62rve3a-ew.a.run.app",
        "http://localhost:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Simple in-memory rate limiter ──────────────────────
class RateLimiter:
    """Token-bucket rate limiter. Allows `max_requests` per `window_seconds` per IP."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def is_allowed(self, request: Request) -> bool:
        ip = self._client_ip(request)
        now = datetime.utcnow().timestamp()
        window_start = now - self.window_seconds
        self._hits[ip] = [t for t in self._hits[ip] if t > window_start]
        if len(self._hits[ip]) >= self.max_requests:
            return False
        self._hits[ip].append(now)
        return True

_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Only rate-limit mutation endpoints (POST), skip GETs and health checks
    if request.method == "POST" and not request.url.path.startswith("/api/health"):
        if not _rate_limiter.is_allowed(request):
            raise HTTPException(429, "Too many requests. Please try again shortly.")
    return await call_next(request)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    booking_ref: str = ""

class PhotoUploadRequest(BaseModel):
    image: str
    bookingRef: str = ""

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

VEHICLES_FALLBACK = [
    {
        "id": "v1",
        "name": "Suzuki Swift",
        "rate": 120,
        "seats": 5,
        "transmission": "automatic",
        "fuelType": "petrol",
        "description": "Reliable and comfortable. Great for exploring the island at your own pace.",
        "imageUrl": "/vehicle.png",
        "features": ["Air Conditioning", "2-Day Minimum", "Bluetooth", "Free Drop-off"],
    }
]

def _fetch_vehicles_from_sheet() -> list[dict]:
    if not SPREADSHEET_ID:
        return VEHICLES_FALLBACK
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Vehicles!A:I',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return VEHICLES_FALLBACK
        headers = [h.strip().lower() for h in rows[0]]
        vehicles = []
        for row in rows[1:]:
            obj = {}
            for i, h in enumerate(headers):
                obj[h] = row[i] if i < len(row) else ''
            if obj.get('id'):
                try:
                    obj['rate'] = int(obj.get('rate', 0))
                except (ValueError, TypeError):
                    logger.warning("Vehicle '%s' has invalid rate '%s' — defaulting to 0", obj.get('id'), obj.get('rate'))
                    obj['rate'] = 0
                vehicles.append(obj)
        # Post-process: split pipe-separated features into arrays
        for v in vehicles:
            if isinstance(v.get('features'), str):
                v['features'] = [f.strip() for f in v['features'].split('|') if f.strip()]
        return vehicles if vehicles else VEHICLES_FALLBACK
    except Exception as e:
        logger.error("Failed to read vehicles from sheet: %s — using fallback", e)
        return VEHICLES_FALLBACK

def _fetch_bookings_from_sheet() -> list[dict]:
    if not SPREADSHEET_ID:
        return []
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Bookings!A:V',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return []
        headers = [h.strip() for h in rows[0]]
        bookings = []
        for row in rows[1:]:
            obj = {}
            for i, h in enumerate(headers):
                obj[h] = row[i] if i < len(row) else ''
            bookings.append(obj)
        return bookings
    except Exception as e:
        logger.warning("Could not read bookings from sheet: %s", e)
        return []

def _parse_date(d: str) -> Optional[date]:
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None

def _normalize_expiry(value) -> str:
    """Normalize a license expiry string to YYYY-MM-DD, or '' if unparseable."""
    if not value:
        return ''
    v = str(value).strip()
    if not v:
        return ''
    # Already YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', v):
        return v
    # DD/MM/YYYY or MM/DD/YYYY (ambiguous) — assume DD/MM/YYYY (Barbados)
    m = re.match(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$', v)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            d1 = datetime(y, a, b)
            d2 = datetime(y, b, a)
            # Prefer DD/MM/YYYY when both valid and different; pick the later date
            pick = max(d1, d2)
            return pick.date().isoformat()
        except ValueError:
            try:
                return datetime(y, a, b).date().isoformat()
            except ValueError:
                try:
                    return datetime(y, b, a).date().isoformat()
                except ValueError:
                    return ''
    # "June 2028" or "2028" only
    m = re.match(r'^(\d{4})$', v)
    if m:
        return f"{m.group(1)}-12-31"
    m = re.match(r'^(?:[A-Za-z]+)\s+(\d{4})$', v)
    if m:
        return f"{m.group(1)}-12-31"
    return ''

def _dates_overlap(a1: date, a2: date, b1: date, b2: date) -> bool:
    """Check if date range [a1, a2] overlaps with [b1, b2]."""
    return a1 <= b2 and b1 <= a2

def _fetch_calendar_events(start_date: str, end_date: str) -> list:
    """Fetch events from Google Calendar for the given date range."""
    try:
        svc = _get_calendar()
        # Time range for the query
        time_min = f"{start_date}T00:00:00-04:00"  # Barbados timezone
        time_max = f"{end_date}T23:59:59-04:00"
        
        events_result = svc.events().list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            maxResults=100,
        ).execute()
        
        events = events_result.get('items', [])
        logger.info("Fetched %d calendar events for %s to %s", len(events), start_date, end_date)
        return events
    except Exception as e:
        logger.warning("Could not fetch calendar events: %s", e)
        return []

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

# ── Google Sheets Integration ──────────────────────────

import re as _re

def _sanitize_sheet_value(val: str) -> str:
    """Prevent Google Sheets formula injection by escaping dangerous prefixes."""
    if not isinstance(val, str):
        return str(val)
    # Strip leading whitespace, then neutralize formula-starting characters
    v = val.strip()
    if v and v[0] in ('=', '+', '-', '@', '\t', '\r', '\n'):
        v = "'" + v
    return v

def _validate_email(email: str) -> bool:
    """Basic email format check."""
    return bool(_re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email))

def _append_to_sheet(req: BookingRequest, ref: str, total_cost: float = 0):
    """Append a booking row to the Google Sheet."""
    if not SPREADSHEET_ID:
        logger.error("BOOKING %s: No SPREADSHEET_ID set — sheet write SKIPPED", ref)
        return False

    try:
        svc = _get_sheets()

        row = [[
            ref,
            'Confirmed',
            datetime.utcnow().isoformat(),
            req.vehicleId or 'v1',
            'Standard Rental Car',
            _sanitize_sheet_value(req.pickupDate or ''),
            _sanitize_sheet_value(req.pickupTime or ''),
            _sanitize_sheet_value(req.returnDate or ''),
            _sanitize_sheet_value(req.returnTime or ''),
            _sanitize_sheet_value(req.customerName or ''),
            _sanitize_sheet_value(req.customerEmail or ''),
            _sanitize_sheet_value(req.customerPhone or ''),
            _sanitize_sheet_value(req.customerAddress or ''),
            _sanitize_sheet_value(req.licenseNumber or ''),
            _sanitize_sheet_value(req.licenseExpiry or ''),
            _sanitize_sheet_value(req.licenseIssuer or ''),
            _sanitize_sheet_value(req.licenseClass or ''),
            'pay_on_pickup',
            total_cost,  # Use server-calculated cost
            '',  # invoice_sent_at
            '',  # notes
            _sanitize_sheet_value(req.licensePhotoUrl or ''),  # licensePhotoUrl
        ]]

        # Ensure the Bookings sheet exists and has the correct headers
        try:
            spreadsheet = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
            existing = [s['properties']['title'] for s in spreadsheet.get('sheets', [])]
            if 'Bookings' not in existing:
                # Create new sheet with headers
                svc.spreadsheets().batchUpdate(
                    spreadsheetId=SPREADSHEET_ID,
                    body={'requests': [{'addSheet': {'properties': {'title': 'Bookings'}}}]},
                ).execute()
                headers = [[
                    'bookingId','status','createdAt','vehicleId','vehicleName',
                    'pickupDate','pickupTime','returnDate','returnTime',
                    'custName','custEmail','custPhone','custAddress',
                    'licenseNum','licenseExpiry','licenseIssuer','licenseClass',
                    'paymentMethod','totalAmount','invoiceSentAt','notes',
                    'licensePhotoUrl',
                ]]
                svc.spreadsheets().values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range='Bookings!A1',
                    valueInputOption='USER_ENTERED',
                    body={'values': headers},
                ).execute()
            else:
                # Sheet exists - check if licensePhotoUrl header is present
                result = svc.spreadsheets().values().get(
                    spreadsheetId=SPREADSHEET_ID, range='Bookings!A1:1',
                ).execute()
                existing_headers = result.get('values', [[]])[0] if result.get('values') else []
                if 'licensePhotoUrl' not in existing_headers:
                    # Add licensePhotoUrl header at the end
                    next_col_index = len(existing_headers)
                    col_letter = chr(ord('A') + next_col_index) if next_col_index < 26 else f"A{chr(ord('A') + next_col_index - 26)}"
                    svc.spreadsheets().values().update(
                        spreadsheetId=SPREADSHEET_ID,
                        range=f'Bookings!{col_letter}1',
                        valueInputOption='USER_ENTERED',
                        body={'values': [['licensePhotoUrl']]},
                    ).execute()
                    logger.info("Added licensePhotoUrl header to existing Bookings sheet")
        except Exception as e:
            logger.warning("Sheet setup check failed: %s", e)

        svc.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range='Bookings!A:V',
            valueInputOption='USER_ENTERED',
            body={'values': row},
        ).execute()
        logger.info("✅ Booking %s written to Google Sheet", ref)
        return True
    except Exception as e:
        logger.error("BOOKING %s: FAILED to write to Google Sheet: %s", ref, e)
        return False


def _update_photo_url_in_sheet(booking_ref: str, photo_url: str):
    """Update the licensePhotoUrl column for a booking in the Sheet."""
    if not SPREADSHEET_ID or not booking_ref:
        return
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Bookings!A2:A',
        ).execute()
        rows = result.get('values', [])
        for i, row in enumerate(rows):
            if row and row[0] == booking_ref:
                row_num = i + 2
                svc.spreadsheets().values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f'Bookings!V{row_num}',
                    valueInputOption='USER_ENTERED',
                    body={'values': [[photo_url]]},
                ).execute()
                logger.info("✅ Photo URL updated for booking %s", booking_ref)
                return
        logger.warning("Booking %s not found in sheet for photo update", booking_ref)
    except Exception as e:
        logger.warning("Could not update photo URL in sheet: %s", e)


@app.get("/api/vehicles")
async def get_vehicles():
    return {"vehicles": _fetch_vehicles_from_sheet()}

@app.post("/api/check-availability-batch")
async def check_availability_batch(req: dict):
    """Check which dates are booked for a date range (for calendar display)."""
    start_date = req.get("startDate", "")
    end_date = req.get("endDate", "")
    if not start_date or not end_date:
        raise HTTPException(400, "startDate and endDate required")

    booked_dates = set()
    try:
        sheet_bookings = _fetch_bookings_from_sheet()
        for b in sheet_bookings:
            bp = _parse_date(b.get("pickupDate", "") or b.get("pickupdate", ""))
            br = _parse_date(b.get("returnDate", "") or b.get("returndate", ""))
            if bp and br:
                current = bp
                while current <= br:
                    booked_dates.add(current.isoformat())
                    current = current + __import__('datetime').timedelta(days=1)
    except Exception as e:
        logger.warning("Batch availability check failed: %s", e)

    return {"bookedDates": sorted(list(booked_dates))}

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
    if return_d <= pickup:
        raise HTTPException(400, "Return date must be after pickup date.")
    sheet_bookings = _fetch_bookings_from_sheet()
    conflicts = []
    for b in sheet_bookings:
        bp = _parse_date(b.get("pickupDate", "") or b.get("pickupdate", ""))
        br = _parse_date(b.get("returnDate", "") or b.get("returndate", ""))
        vid = b.get("vehicleId", "") or b.get("vehicleid", "")
        if bp and br and vid == req.vehicleId:
            if _dates_overlap(pickup, return_d, bp, br):
                conflicts.append({
                    "type": "booking",
                    "existingRef": b.get("bookingId", "") or b.get("bookingid", ""),
                    "pickupDate": b.get("pickupDate", "") or b.get("pickupdate", ""),
                    "returnDate": b.get("returnDate", "") or b.get("returndate", ""),
                })

    # Check Google Calendar events (maintenance, blocked dates, etc.)
    cal_events = _fetch_calendar_events(req.pickupDate, req.returnDate)
    for event in cal_events:
        start = event.get('start', {})
        end = event.get('end', {})
        
        # Handle all-day events
        if 'date' in start:
            ev_start = _parse_date(start['date'])
            ev_end = _parse_date(end['date'])
        else:
            ev_start = _parse_date(start.get('dateTime', '')[:10])
            ev_end = _parse_date(end.get('dateTime', '')[:10])
        
        if ev_start and ev_end and _dates_overlap(pickup, return_d, ev_start, ev_end):
            conflicts.append({
                "type": "calendar",
                "summary": event.get('summary', 'Blocked'),
                "start": start.get('date') or start.get('dateTime', ''),
                "end": end.get('date') or end.get('dateTime', ''),
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

    # Default times to 09:00 if not provided
    req.pickupTime = req.pickupTime or '09:00'
    req.returnTime = req.returnTime or '17:00'

    # Check availability before booking
    pickup = _parse_date(req.pickupDate)
    return_d = _parse_date(req.returnDate)
    if not pickup or not return_d:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")
    if return_d <= pickup:
        raise HTTPException(400, "Return date must be after pickup date.")
    if not req.customerEmail or not _validate_email(req.customerEmail):
        raise HTTPException(400, "Invalid email address.")
    if pickup and return_d:
        sheet_bookings = _fetch_bookings_from_sheet()
        for b in sheet_bookings:
            bp = _parse_date(b.get("pickupDate", "") or b.get("pickupdate", ""))
            br = _parse_date(b.get("returnDate", "") or b.get("returndate", ""))
            vid = b.get("vehicleId", "") or b.get("vehicleid", "")
            if bp and br and vid == req.vehicleId:
                if _dates_overlap(pickup, return_d, bp, br):
                    ref_id = b.get("bookingId", "") or b.get("bookingid", "")
                    raise HTTPException(409, f"Vehicle not available for those dates. Conflict with booking {ref_id}.")

    # Calculate cost server-side (never trust client pricing)
    import datetime as _dt
    days = (_dt.datetime.combine(return_d, _dt.time()) - _dt.datetime.combine(pickup, _dt.time())).days + 1
    if days < 1:
        days = 1
    rate = 0
    for v in _fetch_vehicles_from_sheet():
        if v.get("id") == req.vehicleId:
            rate = int(v.get("rate", 0))
            break
    total_cost = days * rate

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
        "totalDays": days,
        "totalCost": total_cost,
        "created": datetime.utcnow().isoformat(),
    }

    # Notify
    _log_booking_notification(req, ref)
    sheet_ok = _append_to_sheet(req, ref, total_cost)
    _add_to_calendar(req, ref)
    _send_booking_confirmation(req, ref, total_cost, days)

    return {
        "success": True,
        "bookingId": ref,
        "vehicleId": req.vehicleId,
        "customerName": req.customerName,
        "totalDays": days,
        "totalCost": total_cost,
        "sheetStored": sheet_ok,
    }

ADMIN_KEY = os.getenv("ADMIN_KEY", "")

@app.get("/api/bookings")
async def list_bookings(key: str = ""):
    """List all bookings — admin only (requires ?key=...)"""
    if key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
    return {"bookings": _fetch_bookings_from_sheet()}

@app.get("/api/my-bookings/{email}")
async def get_my_bookings(email: str):
    """Get bookings for a specific customer email."""
    if not SPREADSHEET_ID:
        raise HTTPException(503, "Sheets not configured")
    bookings = _fetch_bookings_from_sheet()
    target = email.strip().lower()
    mine = []
    for b in bookings:
        cust_email = (b.get("custEmail") or b.get("customerEmail") or b.get("custemail") or "").strip().lower()
        if cust_email == target:
            mine.append(b)
    # Sort by pickup date (newest last)
    mine.sort(key=lambda b: b.get("pickupDate", "") or b.get("pickupdate", ""))
    return {"bookings": mine}

@app.delete("/api/bookings/{booking_id}")
async def cancel_booking(booking_id: str):
    """Cancel a booking — removes from Sheet and Calendar."""
    # Find and delete from Sheet
    if SPREADSHEET_ID:
        try:
            svc = _get_sheets()
            result = svc.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID, range='Bookings!A:V',
            ).execute()
            rows = result.get('values', [])
            if len(rows) >= 2:
                for i, row in enumerate(rows[1:], start=2):
                    if row and row[0] == booking_id:
                        svc.spreadsheets().batchUpdate(
                            spreadsheetId=SPREADSHEET_ID,
                            body={'requests': [{'deleteDimension': {'range': {'sheetId': 613814778, 'dimension': 'ROWS', 'startIndex': i - 1, 'endIndex': i}}}]}
                        ).execute()
                        break
        except Exception as e:
            logger.warning("Failed to delete from sheet: %s", e)

    # Find and delete from Calendar
    try:
        svc = _get_calendar()
        events = svc.events().list(
            calendarId=CALENDAR_ID, q=booking_id, singleEvents=True
        ).execute()
        for event in events.get('items', []):
            svc.events().delete(calendarId=CALENDAR_ID, eventId=event['id']).execute()
    except Exception as e:
        logger.warning("Failed to delete from calendar: %s", e)

    return {"success": True, "message": f"Booking {booking_id} canceled"}

# ── Profile Endpoints ──────────────────────────────────

class ProfileRequest(BaseModel):
    email: str
    name: str = ""
    phone: str = ""
    address: str = ""
    licenseNumber: str = ""
    licenseExpiry: str = ""
    licenseIssuer: str = ""
    licenseClass: str = ""
    googleId: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Valid email is required")
        return v.strip().lower()

def _get_profiles_sheet_id() -> int:
    """Get the sheet ID for the Profiles tab."""
    try:
        svc = _get_sheets()
        meta = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        for s in meta.get('sheets', []):
            if s['properties']['title'] == 'Profiles':
                return s['properties']['sheetId']
    except Exception as e:
        logger.warning("Failed to get Profiles sheet ID: %s", e)
    return -1

@app.get("/api/profiles/{email}")
async def get_profile(email: str):
    """Get a user profile by email."""
    if not SPREADSHEET_ID:
        raise HTTPException(503, "Sheets not configured")
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Profiles!A:J',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            raise HTTPException(404, "Profile not found")
        headers = [h.strip().lower() for h in rows[0]]
        for row in rows[1:]:
            obj = dict(zip(headers, row))
            if obj.get('email', '').strip().lower() == email.strip().lower():
                return {"profile": obj}
        raise HTTPException(404, "Profile not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get profile: {e}")

@app.post("/api/profiles")
async def create_or_update_profile(req: ProfileRequest):
    """Create or update a user profile."""
    if not SPREADSHEET_ID:
        raise HTTPException(503, "Sheets not configured")
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Profiles!A:J',
        ).execute()
        rows = result.get('values', [])
        headers = [h.strip().lower() for h in rows[0]] if rows else []
        
        existing_row = None
        if len(rows) >= 2:
            for i, row in enumerate(rows[1:], start=2):
                obj = dict(zip(headers, row))
                if obj.get('email', '').strip().lower() == req.email.strip().lower():
                    existing_row = i
                    break

        profile_data = [
            req.email.strip().lower(),
            req.name.strip(),
            req.phone.strip(),
            req.address.strip(),
            req.licenseNumber.strip(),
            req.licenseExpiry.strip(),
            req.licenseIssuer.strip(),
            req.licenseClass.strip(),
            req.googleId.strip(),
            datetime.utcnow().isoformat(),
        ]

        if existing_row:
            svc.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'Profiles!A{existing_row}:J{existing_row}',
                valueInputOption='RAW',
                body={'values': [profile_data]},
            ).execute()
            logger.info("Profile updated for %s", req.email)
        else:
            svc.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range='Profiles!A:J',
                valueInputOption='RAW',
                body={'values': [profile_data]},
            ).execute()
            logger.info("Profile created for %s", req.email)

        return {"success": True, "email": req.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to save profile: {e}")

@app.post("/api/profiles/from-booking")
async def save_profile_from_booking(req: ProfileRequest):
    """Save profile data from a completed booking (called after booking confirmation)."""
    return await create_or_update_profile(req)

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
        raise HTTPException(400, "Invalid base64 image data")

    prompt = """Extract the following fields from this Barbados driver's license image.
Return ONLY valid JSON (no markdown, no backticks) with these exact keys:
  "customerName": full name on the license,
  "licenseNumber": the license/driver number,
  "licenseExpiry": the EXPIRY (expiration / VALID TO / EXPIRES / expiry date) shown on the license, formatted as YYYY-MM-DD. This is the LATEST date on the card — NOT the issue date. If a date has no year, infer it as the next year. Return null only if no date is visible at all,
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
                raise HTTPException(502, f"Vision API error ({resp.status_code})")

            result = resp.json()
            text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            # Strip markdown code fences
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            parsed = json.loads(text)
            # Normalize the expiry date to YYYY-MM-DD
            if parsed.get("licenseExpiry"):
                parsed["licenseExpiry"] = _normalize_expiry(parsed["licenseExpiry"])
            logger.info("License scan result: name=%s license=%s expiry=%s", parsed.get("customerName"), parsed.get("licenseNumber"), parsed.get("licenseExpiry"))
            return parsed
    except json.JSONDecodeError:
        raise HTTPException(502, "Could not parse vision API response as JSON")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("License scan failed: %s", e)
        raise HTTPException(500, f"License scan failed: {e}")

@app.post("/api/upload-photo")
async def upload_photo(req: PhotoUploadRequest):
    """Upload a license photo to GCS and return its blob path."""
    if not req.image:
        raise HTTPException(400, "No image provided")
    try:
        # Run blocking GCS upload in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        blob_path = await loop.run_in_executor(_executor, _upload_to_gcs, req.image, req.bookingRef)
        
        # Update the photo URL in the Sheet if we have a booking reference
        if req.bookingRef:
            await loop.run_in_executor(_executor, _update_photo_url_in_sheet, req.bookingRef, blob_path)
        
        return {"url": blob_path}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Photo upload failed: %s", e)
        raise HTTPException(500, f"Failed to upload photo to GCS: {e}")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
