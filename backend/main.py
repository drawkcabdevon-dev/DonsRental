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
MAIL_FROM = os.environ.get("MAIL_FROM", "bookings@onlineverywhere.com")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "devon@onlineverywhere.com")
COMPANY_NAME = os.environ.get("COMPANY_NAME", "Don's Rental")
COMPANY_PHONE = os.environ.get("COMPANY_PHONE", "+1 (246) 268-2842")

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

# ── Google Gmail singleton ─────────────────────────────
_gmail_svc = None

def _get_gmail():
    global _gmail_svc
    if _gmail_svc:
        return _gmail_svc
    if GOOGLE_SHEETS_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(GOOGLE_SHEETS_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/gmail.send'],
        )
        creds = creds.with_subject(MAIL_FROM)
    else:
        creds, _ = google_default(scopes=['https://www.googleapis.com/auth/gmail.send'])
    _gmail_svc = build('gmail', 'v1', credentials=creds)
    return _gmail_svc

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

# ── Gmail API Email Helpers ────────────────────────────

def _send_gmail(to: str, subject: str, html_body: str, text_body: str) -> bool:
    """Send an email via Gmail API using the service account."""
    if not to:
        logger.warning("No recipient — skipping email")
        return False
    try:
        svc = _get_gmail()
        import base64 as b64
        from email.mime.text import MIMEText

        msg = MIMEText(html_body, 'html')
        msg['to'] = to
        msg['from'] = MAIL_FROM
        msg['subject'] = subject

        raw = b64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        svc.users().messages().send(
            userId='me',
            body={'raw': raw},
        ).execute()
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Gmail API failed for %s: %s", to, e)
        return False


def _escape_html(text: str) -> str:
    """Escape HTML special characters."""
    if not text:
        return ''
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


def _format_date_display(date_val: str) -> str:
    """Format a YYYY-MM-DD date for display."""
    if not date_val:
        return ''
    try:
        d = datetime.strptime(date_val[:10], '%Y-%m-%d')
        return d.strftime('%d %b %Y')
    except Exception:
        return date_val


def _calculate_days(pickup: str, return_date: str) -> int:
    """Calculate number of days between pickup and return."""
    try:
        p = datetime.strptime(pickup[:10], '%Y-%m-%d')
        r = datetime.strptime(return_date[:10], '%Y-%m-%d')
        return max(1, (r - p).days + 1)
    except Exception:
        return 1


def _send_customer_confirmation(req: BookingRequest, ref: str, total_cost: float) -> bool:
    """Send booking confirmation email to customer."""
    days = _calculate_days(req.pickupDate, req.returnDate)
    subject = f"Booking Confirmation — {COMPANY_NAME} (Ref: {ref})"
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #2d2d2d;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:32px 40px 24px;border-bottom:4px solid #FFCC00;">
    <div style="font-size:28px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:-0.5px;">{ _escape_html(COMPANY_NAME) }</div>
    <div style="font-size:12px;color:#FFCC00;margin-top:4px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Car Rental</div>
  </td></tr>

  <!-- Confirmed Bar -->
  <tr><td style="background:#FFCC00;padding:14px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;">&#10003;&nbsp; Booking Confirmed</td>
      <td style="text-align:right;font-size:12px;color:#2d2d2d;font-weight:600;">{ _escape_html(ref) }</td>
    </tr></table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:32px 40px 8px;">
    <p style="margin:0;font-size:18px;color:#1a1a1a;font-weight:700;">Hi {_escape_html(req.customerName)},</p>
    <p style="margin:8px 0 0;font-size:14px;color:#5c5c5c;line-height:1.6;">Your vehicle is ready. Here are your booking details:</p>
  </td></tr>

  <!-- Trip Details -->
  <tr><td style="padding:16px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #2d2d2d;">
      <tr><td style="background:#2d2d2d;padding:10px 20px;">
        <span style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Trip Details</span>
      </td></tr>
      <tr><td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:16px 20px;border-bottom:1px solid #f5f5f0;">
            <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Vehicle</div>
            <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_escape_html(req.vehicleId or 'Standard Rental Car')}</div>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid #f5f5f0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Pick-up</div>
                <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_format_date_display(req.pickupDate)}</div>
                <div style="font-size:13px;color:#5c5c5c;margin-top:2px;">{_escape_html(req.pickupTime or '09:00')}</div>
              </td>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Return</div>
                <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_format_date_display(req.returnDate)}</div>
                <div style="font-size:13px;color:#5c5c5c;margin-top:2px;">{_escape_html(req.returnTime or '17:00')}</div>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 20px;">
            <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Duration</div>
            <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{days} day(s)</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Total Due -->
  <tr><td style="padding:8px 40px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:2px solid #2d2d2d;">
    <tr><td style="padding:24px;text-align:center;">
      <div style="font-size:11px;color:#FFCC00;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Total Due</div>
      <div style="font-size:36px;font-weight:800;color:#ffffff;margin-top:8px;">Bds${total_cost:.2f}</div>
      <div style="font-size:13px;color:#999;margin-top:6px;">Pay at pick-up &mdash; Cash or Card</div>
    </td></tr>
    </table>
  </td></tr>

  <!-- License Info -->
  <tr><td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #2d2d2d;">
      <tr><td style="background:#f5f5f0;padding:10px 20px;border-bottom:2px solid #2d2d2d;">
        <span style="font-size:12px;color:#5c5c5c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">License on File</span>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <span style="font-size:14px;color:#1a1a1a;font-weight:600;">{_escape_html(req.licenseNumber)}</span>
        <span style="font-size:13px;color:#5c5c5c;margin:0 8px;">&bull;</span>
        <span style="font-size:13px;color:#5c5c5c;">Exp {_escape_html(req.licenseExpiry)}</span>
        <span style="font-size:13px;color:#5c5c5c;margin:0 8px;">&bull;</span>
        <span style="font-size:13px;color:#5c5c5c;">{_escape_html(req.licenseIssuer)}</span>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1a1a1a;padding:24px 40px;border-top:4px solid #FFCC00;">
    <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
      {_escape_html(COMPANY_NAME)} &bull; {_escape_html(COMPANY_PHONE)}<br>
      <a href="mailto:{_escape_html(MAIL_FROM)}" style="color:#FFCC00;text-decoration:none;">{_escape_html(MAIL_FROM)}</a>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#666;">Thank you for choosing us. Safe travels!</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

    text_body = f"""{COMPANY_NAME} — Booking Confirmation

Reference: {ref}
Customer: {req.customerName}
Vehicle: {req.vehicleId or 'Standard Rental Car'}
Pick-up: {_format_date_display(req.pickupDate)} at {req.pickupTime or '09:00'}
Return: {_format_date_display(req.returnDate)} at {req.returnTime or '17:00'}
Duration: {days} day(s)
Total Due: Bds${total_cost:.2f}

Payment: Pay when you pick up the vehicle. We accept cash and card.

License: {req.licenseNumber} (exp {req.licenseExpiry}) \u2022 {req.licenseIssuer}

{COMPANY_NAME} \u2022 {COMPANY_PHONE} \u2022 {MAIL_FROM}"""

    return _send_gmail(req.customerEmail, subject, html_body, text_body)


def _send_owner_notification(req: BookingRequest, ref: str, total_cost: float) -> bool:
    """Send new booking notification email to owner."""
    days = _calculate_days(req.pickupDate, req.returnDate)
    subject = f"New Booking: {req.customerName} — {req.vehicleId or 'Standard Rental Car'} ({ref})"

    text_body = f"""New booking received!

Reference: {ref}
Customer: {req.customerName}
Email: {req.customerEmail}
Phone: {req.customerPhone}
Vehicle: {req.vehicleId or 'Standard Rental Car'}
Pick-up: {_format_date_display(req.pickupDate)} at {req.pickupTime or '09:00'}
Return: {_format_date_display(req.returnDate)} at {req.returnTime or '17:00'}
Duration: {days} day(s)
Total: Bds${total_cost:.2f}
License: {req.licenseNumber} (exp {req.licenseExpiry})

View in sheet: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit"""

    return _send_gmail(OWNER_EMAIL, subject, text_body, text_body)


def _send_booking_emails(req: BookingRequest, ref: str, total_cost: float) -> None:
    """Send both customer confirmation and owner notification emails."""
    _send_customer_confirmation(req, ref, total_cost)
    _send_owner_notification(req, ref, total_cost)


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

def _fetch_vehicles_from_sheet() -> list[dict]:
    if not SPREADSHEET_ID:
        return VEHICLES_FALLBACK
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Vehicles!A:G',
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
                except ValueError:
                    obj['rate'] = 0
                vehicles.append(obj)
        return vehicles if vehicles else VEHICLES_FALLBACK
    except Exception as e:
        logger.warning("Could not read vehicles from sheet: %s", e)
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


def _fetch_all_calendar_events() -> list:
    """Fetch ALL booking events from Google Calendar (paginated)."""
    try:
        svc = _get_calendar()
        all_events = []
        page_token = None
        
        while True:
            kwargs = {
                'calendarId': CALENDAR_ID,
                'singleEvents': True,
                'orderBy': 'startTime',
                'maxResults': 250,
                'q': 'BK-',  # Only fetch booking events
            }
            if page_token:
                kwargs['pageToken'] = page_token
                
            events_result = svc.events().list(**kwargs).execute()
            all_events.extend(events_result.get('items', []))
            
            page_token = events_result.get('nextPageToken')
            if not page_token:
                break
        
        logger.info("Fetched %d total booking events from calendar", len(all_events))
        return all_events
    except Exception as e:
        logger.warning("Could not fetch all calendar events: %s", e)
        return []


def _parse_calendar_event(event: dict) -> dict | None:
    """Parse a calendar event into booking fields. Returns None if not a booking event."""
    summary = event.get('summary', '')
    
    # Expect format: "BK-XXXXXXXX — Customer Name"
    if ' — ' not in summary:
        return None
    
    parts = summary.split(' — ', 1)
    if len(parts) != 2:
        return None
    
    ref = parts[0].strip()
    customer_name = parts[1].strip()
    
    # Only process booking refs (BK-XXXXXXXX)
    if not ref.startswith('BK-'):
        return None
    
    # Parse description for additional details
    description = event.get('description', '')
    desc_lines = {}
    for line in description.split('\n'):
        if ':' in line:
            key, _, value = line.partition(':')
            desc_lines[key.strip().lower()] = value.strip()
    
    # Extract dates from event times
    start = event.get('start', {})
    end = event.get('end', {})
    
    pickup_date = ''
    pickup_time = '09:00'
    return_date = ''
    return_time = '17:00'
    
    if 'dateTime' in start:
        # Format: "2024-01-15T09:00:00-04:00"
        pickup_date = start['dateTime'][:10]
        pickup_time = start['dateTime'][11:16] if len(start['dateTime']) > 16 else '09:00'
    elif 'date' in start:
        pickup_date = start['date']
    
    if 'dateTime' in end:
        return_date = end['dateTime'][:10]
        return_time = end['dateTime'][11:16] if len(end['dateTime']) > 16 else '17:00'
    elif 'date' in end:
        return_date = end['date']
    
    # Extract cost from description (format: "Total: Bds$123.45")
    total_cost = 0.0
    total_str = desc_lines.get('total', '')
    if 'Bds$' in total_str:
        try:
            total_cost = float(total_str.replace('Bds$', '').replace(',', '').strip())
        except ValueError:
            pass
    
    return {
        'bookingId': ref,
        'customerName': customer_name,
        'customerEmail': desc_lines.get('email', ''),
        'customerPhone': desc_lines.get('phone', ''),
        'vehicleId': desc_lines.get('vehicle', ''),
        'licenseNumber': desc_lines.get('license', ''),
        'pickupDate': pickup_date,
        'pickupTime': pickup_time,
        'returnDate': return_date,
        'returnTime': return_time,
        'totalCost': total_cost,
    }


def _reconcile_calendar_to_sheet() -> dict:
    """Reconcile calendar events with sheet bookings. Backfills missing entries to sheet.
    
    Returns dict with stats: {total_calendar, total_sheet, backfilled, skipped, errors}.
    """
    stats = {
        'total_calendar': 0,
        'total_sheet': 0,
        'backfilled': 0,
        'skipped': 0,
        'errors': [],
    }
    
    if not SPREADSHEET_ID:
        stats['errors'].append('No SPREADSHEET_ID configured')
        return stats
    
    try:
        # Fetch all data
        calendar_events = _fetch_all_calendar_events()
        sheet_bookings = _fetch_bookings_from_sheet()
        
        stats['total_calendar'] = len(calendar_events)
        stats['total_sheet'] = len(sheet_bookings)
        
        # Build set of existing booking IDs in sheet
        existing_refs = set()
        for b in sheet_bookings:
            ref = b.get('bookingId') or b.get('bookingid') or ''
            if ref:
                existing_refs.add(ref.upper())
        
        # Process each calendar event
        for event in calendar_events:
            parsed = _parse_calendar_event(event)
            if not parsed:
                stats['skipped'] += 1
                continue
            
            ref = parsed['bookingId']
            
            # Skip if already in sheet
            if ref.upper() in existing_refs:
                stats['skipped'] += 1
                continue
            
            # Backfill to sheet
            try:
                svc = _get_sheets()
                
                # Calculate days
                try:
                    pu = datetime.strptime(parsed['pickupDate'], '%Y-%m-%d').date()
                    re = datetime.strptime(parsed['returnDate'], '%Y-%m-%d').date()
                    days = max(1, (re - pu).days + 1)
                except Exception:
                    days = 1
                
                row = [[
                    ref,
                    'Confirmed',
                    event.get('created', datetime.utcnow().isoformat()),
                    parsed['vehicleId'] or 'v1',
                    'Standard Rental Car',
                    parsed['pickupDate'],
                    parsed['pickupTime'],
                    parsed['returnDate'],
                    parsed['returnTime'],
                    parsed['customerName'],
                    parsed['customerEmail'],
                    parsed['customerPhone'],
                    '',  # address
                    parsed['licenseNumber'],
                    '',  # license expiry
                    '',  # license issuer
                    '',  # license class
                    'pay_on_pickup',
                    parsed['totalCost'],
                    '',  # invoice sent
                    '',  # notes
                    '',  # license photo url
                ]]
                
                svc.spreadsheets().values().append(
                    spreadsheetId=SPREADSHEET_ID,
                    range='Bookings!A:V',
                    valueInputOption='USER_ENTERED',
                    body={'values': row},
                ).execute()
                
                stats['backfilled'] += 1
                existing_refs.add(ref.upper())
                logger.info("Backfilled booking %s from calendar to sheet", ref)
                
            except Exception as e:
                error_msg = f"Failed to backfill {ref}: {str(e)}"
                stats['errors'].append(error_msg)
                logger.error(error_msg)
        
        logger.info(
            "Reconciliation complete: %d calendar events, %d sheet bookings, %d backfilled, %d skipped, %d errors",
            stats['total_calendar'], stats['total_sheet'], stats['backfilled'], stats['skipped'], len(stats['errors'])
        )
        
    except Exception as e:
        stats['errors'].append(f"Reconciliation failed: {str(e)}")
        logger.error("Reconciliation failed: %s", e)
    
    return stats

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

def _append_to_sheet(req: BookingRequest, ref: str, total_cost: float = 0) -> bool:
    """Append a booking row to the Google Sheet. Returns True on success."""
    if not SPREADSHEET_ID:
        logger.warning("No SPREADSHEET_ID set — skipping sheet write")
        return False

    try:
        svc = _get_sheets()

        row = [[
            ref,
            'Confirmed',
            datetime.utcnow().isoformat(),
            req.vehicleId or 'v1',
            'Standard Rental Car',
            req.pickupDate or '',
            req.pickupTime or '',
            req.returnDate or '',
            req.returnTime or '',
            req.customerName or '',
            req.customerEmail or '',
            req.customerPhone or '',
            req.customerAddress or '',
            req.licenseNumber or '',
            req.licenseExpiry or '',
            req.licenseIssuer or '',
            req.licenseClass or '',
            'pay_on_pickup',
            total_cost,  # Use server-calculated cost
            '',  # invoice_sent_at
            '',  # notes
            req.licensePhotoUrl or '',  # licensePhotoUrl
        ]]

        # Ensure the Bookings sheet exists and has the correct headers
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

        svc.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range='Bookings!A:V',
            valueInputOption='USER_ENTERED',
            body={'values': row},
        ).execute()
        logger.info("Booking %s written to Google Sheet", ref)
        return True
    except Exception as e:
        logger.error("Failed to write booking %s to Google Sheet: %s", ref, e)
        return False


def _find_license_photo_col(svc, spreadsheet_id: str) -> str:
    """Find the column letter for licensePhotoUrl in the Bookings sheet headers."""
    result = svc.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range='Bookings!A1:1',
    ).execute()
    headers = result.get('values', [[]])[0] if result.get('values') else []
    for i, h in enumerate(headers):
        if h.strip().lower() == 'licensephotourl':
            # Convert 0-based index to Excel column letter
            col_idx = i + 1  # 1-based
            if col_idx <= 26:
                return chr(ord('A') + col_idx - 1)
            else:
                # For columns beyond Z, compute multi-letter
                col_letter = ''
                while col_idx > 0:
                    col_idx, remainder = divmod(col_idx - 1, 26)
                    col_letter = chr(ord('A') + remainder) + col_letter
                return col_letter
    # Fallback: return V if not found (backward compat)
    return 'V'


def _update_photo_url_in_sheet(booking_ref: str, photo_url: str) -> bool:
    """Update the licensePhotoUrl column for a booking in the Sheet. Returns True on success."""
    if not SPREADSHEET_ID or not booking_ref:
        return False
    try:
        svc = _get_sheets()
        col_letter = _find_license_photo_col(svc, SPREADSHEET_ID)
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
                    range=f'Bookings!{col_letter}{row_num}',
                    valueInputOption='USER_ENTERED',
                    body={'values': [[photo_url]]},
                ).execute()
                logger.info("Photo URL updated for booking %s", booking_ref)
                return True
        logger.warning("Booking %s not found in sheet for photo update", booking_ref)
        return False
    except Exception as e:
        logger.error("Failed to update photo URL for booking %s: %s", booking_ref, e)
        return False


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

    # Check existing bookings from Sheet
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
    if return_d < pickup:
        raise HTTPException(400, "Return date must be after pickup date.")
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

    # Overwrite client-sent values with server-calculated values
    req.totalDays = days
    req.totalCost = total_cost

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
    cal_ok = _add_to_calendar(req, ref)

    # Send emails immediately (replaces Apps Script)
    try:
        _send_booking_emails(req, ref, total_cost)
    except Exception as e:
        logger.error("Email sending failed for booking %s: %s", ref, e)

    response = {
        "success": True,
        "bookingId": ref,
        "vehicleId": req.vehicleId,
        "customerName": req.customerName,
        "totalDays": days,
        "totalCost": total_cost,
        "sheetSynced": sheet_ok,
        "calendarCreated": cal_ok is not None,
    }
    if not sheet_ok:
        logger.warning("Booking %s created but Sheet sync FAILED", ref)
    return response

ADMIN_KEY = os.getenv("ADMIN_KEY", "")

@app.get("/api/bookings")
async def list_bookings(key: str = ""):
    """List all bookings — admin only (requires ?key=...)"""
    if key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
    return {"bookings": _fetch_bookings_from_sheet()}

@app.get("/api/bookings/mine")
async def list_my_bookings(email: str = ""):
    """List bookings for a specific customer email."""
    if not email:
        raise HTTPException(400, "Email is required")
    
    all_bookings = _fetch_bookings_from_sheet()
    # Filter bookings where custEmail matches
    my_bookings = [
        b for b in all_bookings
        if (b.get("custEmail") or b.get("customerEmail") or b.get("customeremail") or "").lower() == email.lower()
    ]
    return {"bookings": my_bookings}

@app.delete("/api/bookings/{booking_id}")
async def cancel_booking(booking_id: str, key: str = ""):
    """Cancel a booking — removes from Sheet and Calendar."""
    if not ADMIN_KEY or key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
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
    licensePhotoUrl: str = ""

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
            spreadsheetId=SPREADSHEET_ID, range='Profiles!A:K',
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
            spreadsheetId=SPREADSHEET_ID, range='Profiles!A:K',
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
            req.licensePhotoUrl.strip(),
            datetime.utcnow().isoformat(),
        ]

        if existing_row:
            svc.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'Profiles!A{existing_row}:K{existing_row}',
                valueInputOption='RAW',
                body={'values': [profile_data]},
            ).execute()
            logger.info("Profile updated for %s", req.email)
        else:
            svc.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range='Profiles!A:K',
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
                raise HTTPException(502, f"Vision API error ({resp.status_code})")

            result = resp.json()
            text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            # Strip markdown code fences
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            parsed = json.loads(text)
            logger.info("License scan result: name=%s license=%s", parsed.get("customerName"), parsed.get("licenseNumber"))
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


# ── Admin Dashboard Endpoint ──────────────────────────

def _fetch_profiles_from_sheet() -> list[dict]:
    """Fetch all profiles from the Profiles sheet."""
    if not SPREADSHEET_ID:
        return []
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Profiles!A:K',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return []
        headers = [h.strip().lower() for h in rows[0]]
        profiles = []
        for row in rows[1:]:
            obj = {}
            for i, h in enumerate(headers):
                obj[h] = row[i] if i < len(row) else ''
            # Ensure licensePhotoUrl key exists
            if 'licensephotourl' not in obj and len(row) > 10:
                obj['licensephotourl'] = row[10] if len(row) > 10 else ''
            profiles.append(obj)
        return profiles
    except Exception as e:
        logger.warning("Could not read profiles from sheet: %s", e)
        return []


def _parse_cost(raw) -> float:
    """Parse a totalCost value that may be a string with $/commas."""
    if raw is None or raw == '':
        return 0.0
    try:
        cleaned = str(raw).replace('$', '').replace(',', '').strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


@app.get("/api/admin/dashboard")
async def admin_dashboard(key: str = ""):
    """Aggregate dashboard data: revenue, booking counts, breakdowns."""
    if not ADMIN_KEY or key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
    bookings = _fetch_bookings_from_sheet()
    vehicles = _fetch_vehicles_from_sheet()
    profiles = _fetch_profiles_from_sheet()

    # Build vehicle lookup for display
    vehicle_by_id = {
        v.get('id', ''): v.get('name', v.get('id', 'Unknown'))
        for v in vehicles
    }

    # Build profile lookup keyed by email (lowercased)
    profile_by_email = {}
    for p in profiles:
        email = (p.get('email', '') or '').strip().lower()
        if email:
            profile_by_email[email] = p

    today = date.today()

    total_revenue = 0.0
    current_bookings = 0
    by_month: dict[str, dict] = {}
    by_vehicle: dict[str, dict] = {}

    enriched_bookings = []
    for b in bookings:
        cost = _parse_cost(b.get('totalAmount') or b.get('totalCost') or b.get('totalcost') or 0)
        total_revenue += cost

        # Active/upcoming: return date is today or later
        ret_str = b.get('returnDate') or b.get('returndate') or ''
        ret_d = _parse_date(ret_str)
        if ret_d and ret_d >= today:
            current_bookings += 1

        # Group by month (use created date; fall back to pickup)
        month_key_raw = b.get('created') or b.get('pickupDate') or b.get('pickupdate') or ''
        month_key = ''
        if month_key_raw:
            parsed_month = _parse_date(month_key_raw[:10])
            if parsed_month:
                month_key = parsed_month.strftime('%Y-%m')
        if month_key:
            entry = by_month.setdefault(month_key, {'month': month_key, 'revenue': 0.0, 'count': 0})
            entry['revenue'] += cost
            entry['count'] += 1

        # Group by vehicle
        vid = b.get('vehicleId') or b.get('vehicleid') or 'unknown'
        v_entry = by_vehicle.setdefault(
            vid,
            {
                'vehicleId': vid,
                'vehicleName': vehicle_by_id.get(vid, vid),
                'revenue': 0.0,
                'count': 0,
            },
        )
        v_entry['revenue'] += cost
        v_entry['count'] += 1

        # Enrich with profile
        cust_email = (b.get('custEmail') or b.get('customerEmail') or b.get('customeremail') or '').strip().lower()
        profile = profile_by_email.get(cust_email) or {}

        # Get license photo URL from the booking record (may be empty if not uploaded yet)
        license_photo_url = b.get('licensePhotoUrl') or b.get('licensephotourl') or ''

        enriched_bookings.append({
            'bookingId': b.get('bookingId') or b.get('bookingid') or '',
            'customerName': b.get('custName') or b.get('customerName') or b.get('customername') or '',
            'customerEmail': b.get('custEmail') or b.get('customerEmail') or b.get('customeremail') or '',
            'customerPhone': b.get('custPhone') or b.get('customerPhone') or b.get('customerphone') or '',
            'vehicleId': b.get('vehicleId') or b.get('vehicleid') or '',
            'vehicleName': vehicle_by_id.get(b.get('vehicleId') or b.get('vehicleid') or '', ''),
            'pickupDate': b.get('pickupDate') or b.get('pickupdate') or '',
            'returnDate': b.get('returnDate') or b.get('returndate') or '',
            'totalDays': int(b.get('totalDays') or b.get('totaldays') or 0),
            'totalCost': cost,
            'created': b.get('created') or '',
            'licensePhotoUrl': license_photo_url,
            'profile': {
                'email': profile.get('email', cust_email),
                'name': profile.get('name', ''),
                'phone': profile.get('phone', ''),
                'address': profile.get('address', ''),
                'licenseNumber': profile.get('licensenumber', ''),
                'licenseExpiry': profile.get('licenseexpiry', ''),
                'licenseIssuer': profile.get('licenseissuer', ''),
                'licenseClass': profile.get('licenseclass', ''),
                'licensePhotoUrl': profile.get('licensephotourl', ''),
            },
        })

    # Sort recent bookings newest first
    enriched_bookings.sort(key=lambda x: x.get('created') or '', reverse=True)
    recent = enriched_bookings[:10]

    # Sort breakdowns
    months_sorted = sorted(by_month.values(), key=lambda m: m['month'], reverse=True)
    vehicles_sorted = sorted(by_vehicle.values(), key=lambda v: v['revenue'], reverse=True)

    return {
        'totalRevenue': round(total_revenue, 2),
        'totalBookings': len(bookings),
        'currentBookings': current_bookings,
        'recentBookings': recent,
        'bookingsByMonth': months_sorted,
        'bookingsByVehicle': vehicles_sorted,
    }


@app.post("/api/admin/reconcile")
async def reconcile_sheet(key: str = ""):
    """Reconcile calendar events with sheet bookings. Backfills missing entries to sheet.
    
    Run this to sync any bookings that exist in the calendar but not in the sheet.
    """
    if not ADMIN_KEY or key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
    
    stats = await asyncio.get_event_loop().run_in_executor(
        _executor, _reconcile_calendar_to_sheet
    )
    return stats


@app.get("/api/admin/reconcile/status")
async def reconcile_status(key: str = ""):
    """Check reconciliation status without triggering sync.
    
    Returns counts of calendar events, sheet bookings, and any discrepancies.
    """
    if not ADMIN_KEY or key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")
    
    try:
        calendar_events = await asyncio.get_event_loop().run_in_executor(
            _executor, _fetch_all_calendar_events
        )
        sheet_bookings = await asyncio.get_event_loop().run_in_executor(
            _executor, _fetch_bookings_from_sheet
        )
        
        # Build set of existing booking IDs in sheet
        existing_refs = set()
        for b in sheet_bookings:
            ref = b.get('bookingId') or b.get('bookingid') or ''
            if ref:
                existing_refs.add(ref.upper())
        
        # Check which calendar events are missing from sheet
        missing_from_sheet = []
        for event in calendar_events:
            parsed = _parse_calendar_event(event)
            if parsed and parsed['bookingId'].upper() not in existing_refs:
                missing_from_sheet.append({
                    'bookingId': parsed['bookingId'],
                    'customerName': parsed['customerName'],
                    'pickupDate': parsed['pickupDate'],
                    'returnDate': parsed['returnDate'],
                })
        
        return {
            'totalCalendarEvents': len(calendar_events),
            'totalSheetBookings': len(sheet_bookings),
            'missingFromSheet': len(missing_from_sheet),
            'missingBookings': missing_from_sheet,
        }
    except Exception as e:
        raise HTTPException(500, f"Status check failed: {e}")


# ── Static file mount (MUST be last — catches all unmatched routes) ──
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
