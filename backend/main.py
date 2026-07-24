"""
Don's Rental — Cloud Run Backend
Proxies requests to Vertex AI Agent Engine + license OCR via Gemini.
"""

import json
import logging
import os
import re
import base64
import smtplib
import ssl
from datetime import datetime, date, timedelta
from typing import Optional
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")
GOOGLE_SHEETS_CREDENTIALS = os.environ.get("GOOGLE_SHEETS_CREDENTIALS", "")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "donsrental-license-photos")
GCS_PHOTOS_PREFIX = os.environ.get("GCS_PHOTOS_PREFIX", "license-photos")

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
    licensePhotoUrl: str = ""

class ScanLicenseRequest(BaseModel):
    image: str

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
        return _bookings
    try:
        svc = _get_sheets()
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Bookings!A:V',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return _bookings
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
        return _bookings

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

# ── Google Sheets Integration ──────────────────────────

def _append_to_sheet(req: BookingRequest, ref: str):
    """Append a booking row to the Google Sheet."""
    if not SPREADSHEET_ID:
        logger.info("No SPREADSHEET_ID set — skipping sheet write")
        return

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
            req.totalCost or 0,
            '',  # invoice_sent_at
            '',  # notes
            req.licensePhotoUrl or '',  # licensePhotoUrl
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
    except Exception as e:
        logger.warning("Could not write to Google Sheet: %s", e)


# ── Email Notification ────────────────────────────────

def _send_notification_email(req: BookingRequest, ref: str):
    """Send email notification about a new booking."""
    owner = OWNER_EMAIL or os.environ.get("OWNER_EMAIL", "")
    if not owner:
        logger.info("No OWNER_EMAIL set — skipping email notification")
        return

    subject = f"New Booking: {req.customerName} — {ref}"
    body_text = f"""
New Booking Confirmed!

Reference: {ref}
Customer: {req.customerName}
Email: {req.customerEmail}
Phone: {req.customerPhone}
Pickup: {req.pickupDate} at {req.pickupTime}
Return: {req.returnDate} at {req.returnTime}
License: {req.licenseNumber} (exp {req.licenseExpiry})
Days: {req.totalDays}
Total: Bds${req.totalCost}
    """.strip()

    # Try SendGrid first
    if SENDGRID_API_KEY:
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Email, Content

            sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
            msg = Mail(
                from_email=Email("bookings@donsrental.com", "Don's Rental"),
                to_emails=Email(owner),
                subject=subject,
                html_content=Content("text/plain", body_text),
            )
            sg.client.mail.send.post(request_body=msg.get())
            logger.info("✅ Email notification sent via SendGrid to %s", owner)
            return
        except ImportError:
            logger.warning("sendgrid library not installed, trying SMTP...")
        except Exception as e:
            logger.warning("SendGrid email failed: %s", e)

    # Fallback: SMTP
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    if smtp_host and smtp_user:
        try:
            msg_text = f"Subject: {subject}\n\n{body_text}"
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, 465, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [owner], msg_text)
            logger.info("✅ Email notification sent via SMTP to %s", owner)
            return
        except Exception as e:
            logger.warning("SMTP email failed: %s", e)
    else:
        logger.info("No SENDGRID_API_KEY or SMTP configured — notification only logged")

    # Always log it
    logger.info("📧 NOTIFICATION for %s:\n%s", owner, body_text)


@app.get("/api/vehicles")
async def get_vehicles():
    return {"vehicles": _fetch_vehicles_from_sheet()}

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

    sheet_bookings = _fetch_bookings_from_sheet()
    conflicts = []
    for b in sheet_bookings:
        bp = _parse_date(b.get("pickupDate", "") or b.get("pickupdate", ""))
        br = _parse_date(b.get("returnDate", "") or b.get("returndate", ""))
        vid = b.get("vehicleId", "") or b.get("vehicleid", "")
        if bp and br and vid == req.vehicleId:
            if _dates_overlap(pickup, return_d, bp, br):
                conflicts.append({
                    "existingRef": b.get("bookingId", "") or b.get("bookingid", ""),
                    "pickupDate": b.get("pickupDate", "") or b.get("pickupdate", ""),
                    "returnDate": b.get("returnDate", "") or b.get("returndate", ""),
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
        sheet_bookings = _fetch_bookings_from_sheet()
        for b in sheet_bookings:
            bp = _parse_date(b.get("pickupDate", "") or b.get("pickupdate", ""))
            br = _parse_date(b.get("returnDate", "") or b.get("returndate", ""))
            vid = b.get("vehicleId", "") or b.get("vehicleid", "")
            if bp and br and vid == req.vehicleId:
                if _dates_overlap(pickup, return_d, bp, br):
                    ref_id = b.get("bookingId", "") or b.get("bookingid", "")
                    raise HTTPException(409, f"Vehicle not available for those dates. Conflict with booking {ref_id}.")

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
    _append_to_sheet(req, ref)
    _send_notification_email(req, ref)
    _add_to_calendar(req, ref)

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

@app.post("/api/upload-photo")
async def upload_photo(req: PhotoUploadRequest):
    """Upload a license photo to GCS and return its blob path."""
    if not req.image:
        raise HTTPException(400, "No image provided")
    try:
        # Run blocking GCS upload in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        blob_path = await loop.run_in_executor(_executor, _upload_to_gcs, req.image, req.bookingRef)
        return {"url": blob_path}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Photo upload failed: %s", e)
        raise HTTPException(500, f"Failed to upload photo to GCS: {e}")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
