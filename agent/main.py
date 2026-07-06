"""
Don's Rental — Vertex AI Agent (ADK)
======================================
Deploy to Agent Engine via `python deploy.py`.
"""

import os
import re
import json
import uuid
import base64
import logging
import time
from datetime import datetime

import vertexai
from google.adk.agents import LlmAgent
from google.auth import default
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google import genai as genai_client
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content

logging.basicConfig(level=logging.INFO)

# ── CONFIG (from env vars) ─────────────────
COMPANY_NAME  = os.environ.get('COMPANY_NAME', "Don's Rental")
COMPANY_EMAIL = os.environ.get('COMPANY_EMAIL', 'bookings@donsrental.com')
COMPANY_PHONE = os.environ.get('COMPANY_PHONE', '+1 (555) 000-0000')
OWNER_EMAIL   = os.environ.get('OWNER_EMAIL', '')

GEMINI_API_KEY    = os.environ.get('GEMINI_API_KEY', '')
SENDGRID_API_KEY  = os.environ.get('SENDGRID_API_KEY', '')
SPREADSHEET_ID    = os.environ.get('SPREADSHEET_ID', '')
SHEETS_CREDENTIALS = os.environ.get('GOOGLE_SHEETS_CREDENTIALS', '')

PROJECT  = os.environ.get('VERTEX_AI_PROJECT', 'onlineeverywhere')
LOCATION = os.environ.get('VERTEX_AI_LOCATION', 'us-central1')

# ── INIT CLIENTS ───────────────────────────
vertexai.init(project=PROJECT, location=LOCATION)

_genai_client = None
def _get_genai():
    global _genai_client
    if _genai_client is None and GEMINI_API_KEY:
        _genai_client = genai_client.Client(api_key=GEMINI_API_KEY)
    return _genai_client

_sheets = None
_sg     = None

def _get_sheets():
    global _sheets
    if _sheets:
        return _sheets
    if SHEETS_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(SHEETS_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/spreadsheets'],
        )
    else:
        creds, _ = default(scopes=['https://www.googleapis.com/auth/spreadsheets'])
    _sheets = build('sheets', 'v4', credentials=creds)
    return _sheets

def _get_sg():
    global _sg
    if not _sg and SENDGRID_API_KEY:
        _sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
    return _sg

# ── HELPERS ────────────────────────────────
def _esc(s):
    return str(s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def _bid():
    return 'BK-' + uuid.uuid4().hex[:8].upper()

def _ensure_bookings_sheet(svc):
    try:
        spreadsheet = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        existing = [s['properties']['title'] for s in spreadsheet.get('sheets', [])]
        if 'Bookings' not in existing:
            svc.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={'requests': [{'addSheet': {'properties': {'title': 'Bookings'}}}]},
            ).execute()
            svc.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range='Bookings!A1',
                valueInputOption='USER_ENTERED',
                body={'values': [[
                    'bookingId','status','createdAt','vehicleId','vehicleName',
                    'pickupDate','pickupTime','returnDate','returnTime',
                    'custName','custEmail','custPhone','custAddress',
                    'licenseNum','licenseExpiry','licenseIssuer','licenseClass',
                    'paymentMethod','totalAmount','invoiceSentAt','notes',
                ]]},
            ).execute()
    except Exception as e:
        logging.error(f'Sheet setup: {e}')

# ══════════════════════════════════════════
#  TOOLS  (plain functions — ADK auto-detects them)
# ══════════════════════════════════════════

def get_vehicles() -> list:
    """Fetch available rental vehicles with their daily rates.

    Returns a list of dicts: [{id, name, type, rate, description, icon}].
    Falls back to defaults if the sheet is unavailable.
    """
    defaults = [
        {'id': 'v1', 'name': 'Economy Sedan', 'type': 'economy', 'rate': 35, 'icon': '🚗', 'desc': 'Compact & fuel-efficient.', 'image_url': ''},
        {'id': 'v2', 'name': 'Mid-size SUV',   'type': 'suv',     'rate': 55, 'icon': '🚙', 'desc': 'Spacious ride with extra cargo room.', 'image_url': ''},
        {'id': 'v3', 'name': 'Pickup Truck',   'type': 'truck',   'rate': 65, 'icon': '🛻', 'desc': 'Haul gear or equipment with ease.', 'image_url': ''},
        {'id': 'v4', 'name': 'Luxury Sedan',   'type': 'luxury',  'rate': 85, 'icon': '🚘', 'desc': 'Premium comfort for special occasions.', 'image_url': ''},
    ]
    try:
        svc = _get_sheets()
        if not svc or not SPREADSHEET_ID:
            return defaults
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Vehicles!A:G',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return defaults
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
        return vehicles
    except Exception as e:
        logging.error(f'Vehicles error: {e}')
        return defaults


def scan_license(image_base64: str) -> dict:
    """Extract driver's license fields from a photo using Gemini.

    Args:
        image_base64: Base64-encoded JPEG image (with or without data:image prefix).

    Returns:
        Dict with keys: name, licenseNumber, expiryDate, issuingAuthority,
        dateOfBirth, address, licenseClass (null if not visible).
    """
    client = _get_genai()
    if not client:
        return {'error': 'Gemini API key not configured'}

    if ',' in image_base64:
        image_base64 = image_base64.split(',', 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception:
        return {'error': 'Invalid base64 image data'}

    try:
        prompt = """Extract the following fields from this driver's license image.
Return ONLY valid JSON (no markdown, no backticks) with these exact keys:
  "name": full name,
  "licenseNumber": the license/driver number,
  "expiryDate": expiration date,
  "issuingAuthority": issuing state/agency,
  "dateOfBirth": date of birth,
  "address": address,
  "licenseClass": class/type.
If a field is not visible, set it to null."""
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[prompt, {'mime_type': 'image/jpeg', 'data': image_bytes}],
        )
        raw = response.text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        return json.loads(raw)
    except json.JSONDecodeError:
        return {'raw_text': raw, 'error': 'Could not parse as structured JSON'}
    except Exception as e:
        return {'error': str(e)}


def create_booking(
    vehicle_id: str,
    vehicle_name: str,
    pickup_date: str,
    pickup_time: str,
    return_date: str,
    return_time: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    customer_address: str,
    license_number: str,
    license_expiry: str,
    license_issuer: str,
    license_class: str,
    payment_method: str = 'pay_on_pickup',
) -> dict:
    """Create a rental booking in the spreadsheet and send confirmation emails.

    Args:
        vehicle_id: Vehicle identifier (e.g. v1, v2).
        vehicle_name: Human-readable vehicle name.
        pickup_date: ISO date string (YYYY-MM-DD).
        pickup_time: Time string (HH:MM).
        return_date: ISO date string (YYYY-MM-DD).
        return_time: Time string (HH:MM).
        customer_name: Full name of the customer.
        customer_email: Email for invoice.
        customer_phone: Contact number.
        customer_address: Physical address (optional).
        license_number: Driver's license number.
        license_expiry: License expiry date.
        license_issuer: Issuing authority.
        license_class: License class/type.
        payment_method: pay_on_pickup, bank_transfer.

    Returns:
        Dict with bookingId, success, message.
    """
    b_id = _bid()
    now  = datetime.utcnow().isoformat() + 'Z'

    # Calculate days + total
    try:
        start = datetime.strptime(pickup_date, '%Y-%m-%d')
        end   = datetime.strptime(return_date, '%Y-%m-%d')
        days  = max(1, (end - start).days + 1)
    except Exception:
        days = 1

    rate = 0
    for v in get_vehicles():
        if isinstance(v, dict) and v.get('id') == vehicle_id:
            rate = int(v.get('rate', 0))
            break
    total = days * rate

    row = [
        b_id, 'Confirmed', now,
        vehicle_id, vehicle_name,
        pickup_date, pickup_time, return_date, return_time,
        customer_name, customer_email, customer_phone, customer_address,
        license_number, license_expiry, license_issuer, license_class,
        payment_method, total, '', '',
    ]

    # Write to sheet
    sheets_ok = False
    try:
        svc = _get_sheets()
        if svc and SPREADSHEET_ID:
            _ensure_bookings_sheet(svc)
            svc.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range='Bookings!A:V',
                valueInputOption='USER_ENTERED',
                body={'values': [row]},
            ).execute()
            sheets_ok = True
    except Exception as e:
        logging.error(f'Sheet write: {e}')

    # Send emails (optional — skips gracefully if SendGrid not configured)
    email_ok = False
    try:
        email_ok = _send_emails(
            b_id, customer_name, customer_email,
            vehicle_name, pickup_date, pickup_time,
            return_date, return_time, days, total,
            license_number, license_expiry, license_issuer,
            payment_method,
        )
    except Exception as e:
        logging.warning(f'Email skipped (optional feature): {e}')

    return {
        'booking_id': b_id,
        'success': True,
        'sheets_stored': sheets_ok,
        'email_sent': email_ok,
        'total': total,
        'days': days,
    }


def _send_emails(b_id, name, email, vehicle, pu_d, pu_t, re_d, re_t,
                 days, total, lic_num, lic_exp, lic_iss, pm):
    sg = _get_sg()
    if not sg:
        return False

    payment_txt = {
        'pay_on_pickup': 'Pay when you pick up the vehicle. We accept cash and card.',
        'bank_transfer': f'Transfer to: Bank: Your Bank | Account: 1234-5678 | Use ref {b_id}',
    }.get(pm, 'Details provided at pickup.')

    invoice = f'''<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;">
<div style="background:#0f3460;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
  <h2 style="margin:0;">{_esc(COMPANY_NAME)}</h2>
  <p style="margin:4px 0 0;opacity:.85;">Booking Confirmation &amp; Invoice</p>
</div>
<div style="padding:24px 32px;border:1px solid #e0e0e0;border-top:0;border-radius:0 0 12px 12px;">
  <p>Hi <strong>{_esc(name)}</strong>,</p><p>Your booking is confirmed!</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Reference</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;">{_esc(b_id)}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Vehicle</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{_esc(vehicle)}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Pick-up</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{_esc(pu_d)} at {_esc(pu_t)}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Return</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{_esc(re_d)} at {_esc(re_t)}</td></tr>
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Duration</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">{days} day{"s" if days>1 else ""}</td></tr>
    <tr><td style="padding:8px 12px;color:#666;">Total Due</td>
        <td style="padding:8px 12px;font-size:1.15rem;font-weight:700;color:#0f3460;">${total}</td></tr>
  </table>
  <h3>Payment</h3><p style="color:#555;">{payment_txt}</p>
  <h3 style="margin-top:24px;">License</h3>
  <p style="color:#555;">{_esc(lic_num)} (exp {_esc(lic_exp)}) &bull; {_esc(lic_iss)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#999;font-size:.85rem;">{_esc(COMPANY_NAME)} &bull; {_esc(COMPANY_PHONE)}</p>
</div></body></html>'''

    try:
        msg = Mail(
            from_email=Email(COMPANY_EMAIL, COMPANY_NAME),
            to_emails=To(email),
            subject=f'Booking Confirmation & Invoice — {COMPANY_NAME} (Ref: {b_id})',
            html_content=Content('text/html', invoice),
        )
        sg.client.mail.send.post(request_body=msg.get())
        logging.info(f'Invoice sent to {email} for {b_id}')
    except Exception as e:
        logging.error(f'Invoice send failed: {e}')
        time.sleep(1)
        try:
            sg.client.mail.send.post(request_body=msg.get())
        except Exception as e2:
            logging.error(f'Retry also failed: {e2}')
            return False

    # Notify owner
    if OWNER_EMAIL:
        try:
            alert = Mail(
                from_email=Email(COMPANY_EMAIL, COMPANY_NAME),
                to_emails=To(OWNER_EMAIL),
                subject=f'New Booking: {name} — {vehicle} ({b_id})',
                html_content=Content('text/html', f'<p>{name} booked {vehicle} from {pu_d} to {re_d}. Total: ${total}. Check your sheet.</p>'),
            )
            sg.client.mail.send.post(request_body=alert.get())
        except Exception:
            pass
    return True


# ══════════════════════════════════════════
#  AGENT DEFINITION
# ══════════════════════════════════════════

AGENT_INSTRUCTIONS = """
You are a friendly car rental booking assistant for {company}.

Your job is to help customers complete a booking step by step. Use your
tools to get vehicles, create bookings, and scan licenses.

Booking flow:
  1. Show available vehicles (call get_vehicles) and help the customer pick one.
  2. Collect pickup and return dates/times.
  3. Collect customer name, email, phone, and address.
  4. Collect license info — the customer can provide it manually OR
     upload a photo. If they upload a photo, call scan_license.
  5. Confirm all details with the customer.
  6. Call create_booking to finalize.
  7. Tell them the booking reference and that an invoice was emailed.

Important: Always confirm with the customer before calling create_booking.
Be concise and friendly.
""".format(company=COMPANY_NAME)

agent = LlmAgent(
    name="rental_booking_agent",
    model="gemini-2.0-flash-001",
    instruction=AGENT_INSTRUCTIONS,
    tools=[get_vehicles, scan_license, create_booking],
)
