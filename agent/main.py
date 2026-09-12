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
from datetime import datetime, date, timedelta
from urllib.request import Request, urlopen
from urllib.error import URLError

import vertexai
from google.adk.agents import LlmAgent
from google.auth import default
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google import genai as genai_client

logging.basicConfig(level=logging.INFO)

_initialized = False

def _ensure_init():
    global _initialized
    if not _initialized:
        p = os.environ.get('VERTEX_AI_PROJECT', 'onlineeverywhere')
        l = os.environ.get('VERTEX_AI_LOCATION', 'us-central1')
        vertexai.init(project=p, location=l)
        _initialized = True

def _env(key, default_val=''):
    return os.environ.get(key, default_val)

_genai_client = None
def _get_genai():
    global _genai_client
    try:
        k = _env('GEMINI_API_KEY')
        if _genai_client is None and k:
            _genai_client = genai_client.Client(api_key=k)
        return _genai_client
    except Exception as e:
        logging.exception('_get_genai failed')
        return None

_sheets_svc = None
def _get_sheets():
    global _sheets_svc
    try:
        if _sheets_svc:
            return _sheets_svc
        _ensure_init()
        creds_json = _env('GOOGLE_SHEETS_CREDENTIALS')
        if creds_json:
            creds = service_account.Credentials.from_service_account_info(
                json.loads(creds_json),
                scopes=['https://www.googleapis.com/auth/spreadsheets'],
            )
        else:
            creds, _ = default(scopes=['https://www.googleapis.com/auth/spreadsheets'])
        _sheets_svc = build('sheets', 'v4', credentials=creds)
        return _sheets_svc
    except Exception as e:
        logging.exception('_get_sheets failed')
        return None

_calendar_svc = None
CALENDAR_ID = os.environ.get('GOOGLE_CALENDAR_ID', 'primary')

def _get_calendar():
    global _calendar_svc
    try:
        if _calendar_svc:
            return _calendar_svc
        _ensure_init()
        creds_json = _env('GOOGLE_SHEETS_CREDENTIALS')
        if creds_json:
            creds = service_account.Credentials.from_service_account_info(
                json.loads(creds_json),
                scopes=['https://www.googleapis.com/auth/calendar'],
            )
        else:
            creds, _ = default(scopes=['https://www.googleapis.com/auth/calendar'])
        _calendar_svc = build('calendar', 'v3', credentials=creds)
        return _calendar_svc
    except Exception as e:
        logging.exception('_get_calendar failed')
        return None

_gmail_svc = None
def _get_gmail():
    global _gmail_svc
    try:
        if _gmail_svc:
            return _gmail_svc
        _ensure_init()
        creds_json = _env('GOOGLE_SHEETS_CREDENTIALS')
        if creds_json:
            creds = service_account.Credentials.from_service_account_info(
                json.loads(creds_json),
                scopes=['https://www.googleapis.com/auth/gmail.send'],
            )
            creds = creds.with_subject(_company_email())
        else:
            creds, _ = default(scopes=['https://www.googleapis.com/auth/gmail.send'])
        _gmail_svc = build('gmail', 'v1', credentials=creds)
        return _gmail_svc
    except Exception as e:
        logging.exception('_get_gmail failed')
        return None

def _esc(s):
    return str(s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def _escape_html(text):
    if not text:
        return ''
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))

def _format_date_display(date_val):
    if not date_val:
        return ''
    try:
        from datetime import datetime as _dt
        d = _dt.strptime(str(date_val)[:10], '%Y-%m-%d')
        return d.strftime('%d %b %Y')
    except Exception:
        return str(date_val)

def _bid():
    return 'BK-' + uuid.uuid4().hex[:8].upper()

def _parse_date(d: str):
    try:
        return datetime.strptime(d, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None

def _dates_overlap(a1, a2, b1, b2):
    return a1 <= b2 and b1 <= a2

def _ensure_bookings_sheet(svc):
    sid = _env('SPREADSHEET_ID')
    if not sid:
        return
    try:
        spreadsheet = svc.spreadsheets().get(spreadsheetId=sid).execute()
        existing = [s['properties']['title'] for s in spreadsheet.get('sheets', [])]
        if 'Bookings' not in existing:
            svc.spreadsheets().batchUpdate(
                spreadsheetId=sid,
                body={'requests': [{'addSheet': {'properties': {'title': 'Bookings'}}}]},
            ).execute()
            svc.spreadsheets().values().update(
                spreadsheetId=sid,
                range='Bookings!A1',
                valueInputOption='USER_ENTERED',
                body={'values': [[
                    'bookingId','status','createdAt','vehicleId','vehicleName',
                    'pickupDate','pickupTime','returnDate','returnTime',
                    'custName','custEmail','custPhone','custAddress',
                    'licenseNum','licenseExpiry','licenseIssuer','licenseClass',
                    'paymentMethod','totalAmount','totalDays','invoiceSentAt','notes',
                    'licensePhotoUrl',
                ]]},
            ).execute()
    except Exception as e:
        logging.error(f'Sheet setup: {e}')

def _company():
    return _env('COMPANY_NAME', "Don's Rental")

def _company_email():
    return _env('COMPANY_EMAIL', 'bookings@onlineverywhere.com')

def _company_phone():
    return _env('COMPANY_PHONE', '+1 (246) 268-2842')

def _owner_email():
    return _env('OWNER_EMAIL', 'devon@onlineverywhere.com')


# ══════════════════════════════════════════
#  DATA HELPERS
# ══════════════════════════════════════════

VEHICLES_FALLBACK = [
    {
        "id": "v1",
        "name": "Standard Rental Car",
        "rate": 120,
        "seats": 5,
        "transmission": "automatic",
        "description": "Clean, reliable car for getting around Barbados.",
        "features": "Air Conditioning",
    }
]

def _fetch_vehicles_from_sheet() -> list:
    """Read vehicles from Google Sheets Vehicles tab. Falls back to VEHICLES_FALLBACK on error."""
    try:
        sid = _env('SPREADSHEET_ID')
        if not sid:
            logging.warning('No SPREADSHEET_ID set')
            return VEHICLES_FALLBACK
        svc = _get_sheets()
        if not svc:
            logging.warning('Could not initialize Sheets service')
            return VEHICLES_FALLBACK
        result = svc.spreadsheets().values().get(
            spreadsheetId=sid, range='Vehicles!A:G',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            logging.warning('Vehicles sheet has no data rows')
            return VEHICLES_FALLBACK
        headers = [h.strip().lower() for h in rows[0]]
        vehicles = []
        for row in rows[1:]:
            if not row:
                continue
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
        logging.exception('_fetch_vehicles_from_sheet failed')
        return VEHICLES_FALLBACK


def _fetch_booked_dates_from_sheet(vehicle_id: str) -> set:
    """Return active booked dates for a vehicle from the Bookings sheet."""
    try:
        sid = _env('SPREADSHEET_ID')
        booked = set()
        if not sid:
            return booked
        svc = _get_sheets()
        if not svc:
            return booked
        result = svc.spreadsheets().values().get(
            spreadsheetId=sid, range='Bookings!A:V',
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return booked
        headers = [h.strip().lower() for h in rows[0]]
        for row in rows[1:]:
            if not row:
                continue
            obj = {}
            for i, h in enumerate(headers):
                obj[h] = row[i] if i < len(row) else ''
            status = (obj.get('status') or obj.get('bookingstatus') or 'Confirmed').strip().lower()
            if obj.get('vehicleid') != vehicle_id or status in {'cancelled', 'canceled'}:
                continue
            bp = _parse_date(obj.get('pickupdate', ''))
            br = _parse_date(obj.get('returndate', ''))
            if bp and br:
                current = bp
                while current <= br:
                    booked.add(current.isoformat())
                    current += timedelta(days=1)
        return booked
    except Exception as e:
        logging.exception('_fetch_booked_dates_from_sheet failed')
        return set()


def _fetch_calendar_blocked_dates(start_date: str, end_date: str) -> set:
    """Return all dates blocked by Google Calendar events."""
    try:
        blocked = set()
        svc = _get_calendar()
        if not svc:
            return blocked
        time_min = f'{start_date}T00:00:00-04:00'
        time_max = f'{end_date}T23:59:59-04:00'
        events_result = svc.events().list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            maxResults=100,
        ).execute()
        for event in events_result.get('items', []):
            start = event.get('start') or {}
            end = event.get('end') or {}
            if 'date' in start:
                ev_start = _parse_date(start.get('date', ''))
                ev_end = _parse_date(end.get('date', ''))
                if ev_end:
                    ev_end -= timedelta(days=1)
            else:
                ev_start = _parse_date((start.get('dateTime') or '')[:10])
                ev_end = _parse_date((end.get('dateTime') or '')[:10])
            if ev_start and ev_end:
                current = ev_start
                while current <= ev_end:
                    blocked.add(current.isoformat())
                    current += timedelta(days=1)
        return blocked
    except Exception as e:
        logging.exception('_fetch_calendar_blocked_dates failed')
        return set()


def _get_all_booked_dates(vehicle_id: str, start_date: str, end_date: str) -> set:
    """Merge booked dates from Sheets + Calendar for a date range."""
    try:
        sheet_dates = _fetch_booked_dates_from_sheet(vehicle_id)
        cal_dates = _fetch_calendar_blocked_dates(start_date, end_date)
        return sheet_dates | cal_dates
    except Exception as e:
        logging.exception('_get_all_booked_dates failed')
        return set()


# ══════════════════════════════════════════
#  TOOLS
# ══════════════════════════════════════════

def get_vehicles() -> list:
    """Return available vehicles with pricing.

    Reads from Google Sheets. Falls back to VEHICLES_FALLBACK if unavailable.
    Returns a list of dicts: [{id, name, rate, description, features}].
    """
    try:
        vehicles = _fetch_vehicles_from_sheet()
        result = []
        for v in vehicles:
            result.append({
                'id': v.get('id', ''),
                'name': v.get('name', ''),
                'rate': v.get('rate', 0),
                'type': v.get('type', 'standard'),
                'seats': v.get('seats', ''),
                'transmission': v.get('transmission', 'automatic'),
                'description': v.get('description', ''),
                'features': v.get('features', 'Air Conditioning'),
                'image_url': v.get('imageurl', v.get('imageUrl', '/vehicle.png')),
            })
        return result
    except Exception as e:
        logging.exception('get_vehicles tool error')
        return [{'id': v['id'], 'name': v['name'], 'rate': v['rate'], 'type': 'standard',
                 'seats': v['seats'], 'transmission': v['transmission'],
                 'description': v['description'], 'features': v['features'],
                 'image_url': '/vehicle.png'} for v in VEHICLES_FALLBACK]


def find_available_dates(vehicle_id: str, duration_days: int, start_from: str = '') -> dict:
    """Find the next available date windows for a given rental duration.

    Checks both Google Sheets bookings AND Google Calendar events to find
    real availability. Scans forward from start_from (default: today) and
    returns the first 5 available windows.

    Args:
        vehicle_id: Vehicle identifier returned by get_vehicles().
        duration_days: Number of days for the rental (e.g. 3 for a 3-day trip).
        start_from: ISO date to start searching from (YYYY-MM-DD). Defaults to today.

    Returns:
        Dict with {available_dates: [{pickup, return, total_days, label}], search_from, searched_days}.
    """
    try:
        if duration_days < 1:
            duration_days = 2

        today = date.today()
        search_start = _parse_date(start_from) if start_from else today
        if not search_start:
            search_start = today

        # Search the next 90 days for available windows
        search_end = search_start + timedelta(days=90)
        all_booked = _get_all_booked_dates(vehicle_id, search_start.isoformat(), search_end.isoformat())

        available = []
        current = search_start
        while current <= search_end - timedelta(days=duration_days - 1):
            window_end = current + timedelta(days=duration_days - 1)
            # Check if any date in this window is booked
            conflict = False
            check = current
            while check <= window_end:
                if check.isoformat() in all_booked:
                    conflict = True
                    break
                check += timedelta(days=1)
            if not conflict:
                day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                start_day = day_names[current.weekday()]
                end_day = day_names[window_end.weekday()]
                label = f'{current.strftime("%b %d")} ({start_day}) to {window_end.strftime("%b %d")} ({end_day})'
                available.append({
                    'pickup': current.isoformat(),
                    'return': window_end.isoformat(),
                    'total_days': duration_days,
                    'label': label,
                })
                if len(available) >= 5:
                    break
                # Skip ahead to avoid overlapping windows
                current += timedelta(days=duration_days)
            else:
                # Jump past the conflict
                current += timedelta(days=1)

        return {
            'available_dates': available,
            'search_from': search_start.isoformat(),
            'searched_days': 90,
            'duration_days': duration_days,
        }
    except Exception as e:
        logging.exception('find_available_dates tool error')
        return {
            'available_dates': [],
            'search_from': start_from or date.today().isoformat(),
            'searched_days': 0,
            'duration_days': duration_days,
            'error': f'Could not check availability: {e}',
        }


def scan_license(image_base64: str) -> dict:
    """Extract driver's license fields from a photo using Gemini.

    Args:
        image_base64: Base64-encoded JPEG image (with or without data:image prefix).

    Returns:
        Dict with keys: customerName, licenseNumber, licenseExpiry, licenseIssuer,
        customerAddress, licenseClass (null if not visible).
    """
    try:
        client = _get_genai()
        if not client:
            return {'error': 'Gemini API key not configured'}

        if not image_base64:
            return {'error': 'No image data provided'}

        if ',' in image_base64:
            image_base64 = image_base64.split(',', 1)[1]

        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception:
            return {'error': 'Invalid base64 image data'}

        prompt = """Extract the following fields from this Barbados driver's license image.
Return ONLY valid JSON (no markdown, no backticks) with these exact keys:
  "customerName": full name on the license,
  "licenseNumber": the license/driver number,
  "licenseExpiry": the EXPIRY (expiration / VALID TO / EXPIRES / expiry date) shown on the license, formatted as YYYY-MM-DD. This is the LATEST date on the card — NOT the issue date. If a date has no year, infer it as the next year. Return null only if no date is visible at all,
  "licenseIssuer": issuing authority (e.g. "Barbados Licensing Authority"),
  "customerAddress": address on the license,
  "licenseClass": license class/type.
If a field is not visible, set it to null."""
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[prompt, {'mime_type': 'image/jpeg', 'data': image_bytes}],
        )
        if not response or not hasattr(response, 'text') or response.text is None:
            return {'error': 'Gemini returned an empty response. The image may be unclear.'}
        raw = response.text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        parsed = json.loads(raw)
        if parsed.get('licenseExpiry'):
            parsed['licenseExpiry'] = _normalize_expiry(parsed['licenseExpiry'])
        return parsed
    except json.JSONDecodeError:
        return {'raw_text': raw if 'raw' in locals() else '', 'error': 'Could not parse as structured JSON'}
    except Exception as e:
        logging.exception('scan_license tool error')
        return {'error': str(e)}


def _normalize_expiry(value) -> str:
    """Normalize a license expiry string to YYYY-MM-DD, or '' if unparseable."""
    if not value:
        return ''
    v = str(value).strip()
    if not v:
        return ''
    if re.match(r'^\d{4}-\d{2}-\d{2}$', v):
        return v
    m = re.match(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$', v)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            d1 = datetime(y, a, b)
            d2 = datetime(y, b, a)
            return max(d1, d2).date().isoformat()
        except ValueError:
            try:
                return datetime(y, a, b).date().isoformat()
            except ValueError:
                try:
                    return datetime(y, b, a).date().isoformat()
                except ValueError:
                    return ''
    m = re.match(r'^(\d{4})$', v)
    if m:
        return f'{m.group(1)}-12-31'
    m = re.match(r'^(?:[A-Za-z]+)\s+(\d{4})$', v)
    if m:
        return f'{m.group(1)}-12-31'
    return ''


def check_availability(vehicle_id: str, pickup_date: str, return_date: str) -> dict:
    """Check if a vehicle is available for the given date range.

    Checks BOTH Google Sheets bookings AND Google Calendar events.

    Args:
        vehicle_id: Vehicle identifier (e.g. v1, v2).
        pickup_date: ISO date string (YYYY-MM-DD).
        return_date: ISO date string (YYYY-MM-DD).

    Returns:
        Dict with {available: bool, conflicts: [...]}.
    """
    pu = _parse_date(pickup_date)
    re_d = _parse_date(return_date)
    if not pu or not re_d:
        return {'available': False, 'conflicts': [], 'error': 'Invalid date format. Use YYYY-MM-DD.'}

    conflicts = []
    lookup_failures = []

    # Check Sheets bookings
    sid = _env('SPREADSHEET_ID')
    try:
        svc = _get_sheets()
        if svc and sid:
            result = svc.spreadsheets().values().get(
                spreadsheetId=sid, range='Bookings!A:V',
            ).execute()
            rows = result.get('values', [])
            if len(rows) >= 2:
                headers = [h.strip().lower() for h in rows[0]]
                for row in rows[1:]:
                    if not row:
                        continue
                    obj = {}
                    for i, h in enumerate(headers):
                        obj[h] = row[i] if i < len(row) else ''
                    if obj.get('vehicleid') != vehicle_id:
                        continue
                    status = (obj.get('status') or obj.get('bookingstatus') or 'Confirmed').strip().lower()
                    if status in {'cancelled', 'canceled'}:
                        continue
                    existing_pu = _parse_date(obj.get('pickupdate', ''))
                    existing_re = _parse_date(obj.get('returndate', ''))
                    if existing_pu and existing_re:
                        if _dates_overlap(pu, re_d, existing_pu, existing_re):
                            conflicts.append({
                                'type': 'booking',
                                'existing_booking': obj.get('bookingid', ''),
                                'pickup': obj.get('pickupdate'),
                                'return': obj.get('returndate'),
                                'customer': obj.get('custname', ''),
                                'status': obj.get('status', obj.get('bookingstatus', 'Confirmed')),
                            })
        else:
            lookup_failures.append('sheets')
    except Exception as e:
        logging.error(f'Sheet availability check: {e}')
        lookup_failures.append('sheets')

    # Check Google Calendar events
    try:
        svc = _get_calendar()
        if not svc:
            lookup_failures.append('calendar')
        else:
            time_min = f'{pickup_date}T00:00:00-04:00'
            time_max = f'{return_date}T23:59:59-04:00'
            events_result = svc.events().list(
                calendarId=CALENDAR_ID,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime',
                maxResults=100,
            ).execute()
            for event in events_result.get('items', []):
                start = event.get('start') or {}
                end = event.get('end') or {}
                if 'date' in start:
                    ev_start = _parse_date(start.get('date', ''))
                    ev_end = _parse_date(end.get('date', ''))
                    if ev_end:
                        ev_end -= timedelta(days=1)
                else:
                    ev_start = _parse_date((start.get('dateTime') or '')[:10])
                    ev_end = _parse_date((end.get('dateTime') or '')[:10])
                if ev_start and ev_end and _dates_overlap(pu, re_d, ev_start, ev_end):
                    conflicts.append({
                        'type': 'calendar',
                        'summary': event.get('summary', 'Blocked'),
                        'start': start.get('date') or (start.get('dateTime') or ''),
                        'end': end.get('date') or (end.get('dateTime') or ''),
                    })
    except Exception as e:
        logging.error(f'Calendar availability check: {e}')
        lookup_failures.append('calendar')

    result = {
        'available': not lookup_failures and len(conflicts) == 0,
        'conflicts': conflicts,
        'lookup_failures': lookup_failures,
    }
    if lookup_failures:
        result['error'] = 'Availability could not be verified. Please try again.'
    return result


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
        vehicle_id: Vehicle identifier (e.g. v1).
        vehicle_name: Human-readable vehicle name.
        pickup_date: ISO date string (YYYY-MM-DD).
        pickup_time: Time string (HH:MM). Defaults to 09:00 if empty.
        return_date: ISO date string (YYYY-MM-DD).
        return_time: Time string (HH:MM). Defaults to 09:00 if empty.
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
    try:
        b_id = _bid()
        now = datetime.utcnow().isoformat() + 'Z'

        pickup_time = pickup_time or '09:00'
        return_time = return_time or '09:00'

        try:
            start = datetime.strptime(pickup_date, '%Y-%m-%d')
            end = datetime.strptime(return_date, '%Y-%m-%d')
            days = max(1, (end - start).days + 1)
        except Exception:
            days = 1

        avail = check_availability(vehicle_id, pickup_date, return_date)
        if not avail.get('available'):
            msg = f"Vehicle '{vehicle_name}' is not available for those dates."
            c = avail.get('conflicts', [])
            if c:
                first = c[0]
                if first.get('type') == 'calendar':
                    msg += f" Calendar blocked: {first.get('summary', 'Event')} ({first.get('start', '')} to {first.get('end', '')})."
                else:
                    msg += f" Existing booking: {first.get('pickup')} to {first.get('return')} (status: {first.get('status', 'Confirmed')})."
            msg += " Suggest alternative dates or use find_available_dates to find open slots."
            return {'booking_id': None, 'success': False, 'message': msg, 'conflicts': c}

        rate = 0
        vehicles = get_vehicles()
        for v in vehicles:
            if isinstance(v, dict) and v.get('id') == vehicle_id:
                rate = int(v.get('rate', 0))
                break
        if rate == 0 and vehicles:
            rate = int(vehicles[0].get('rate', 120))
            logging.warning(f'Vehicle {vehicle_id} not found, using fallback rate: {rate}')
        total = days * rate

        row = [
            b_id, 'Confirmed', now,
            vehicle_id, vehicle_name,
            pickup_date, pickup_time, return_date, return_time,
            customer_name, customer_email, customer_phone, customer_address,
            license_number, license_expiry, license_issuer, license_class,
            payment_method, total, days, '', '',
            '',
        ]

        sid = _env('SPREADSHEET_ID')
        sheets_ok = False
        try:
            svc = _get_sheets()
            if svc and sid:
                _ensure_bookings_sheet(svc)
                svc.spreadsheets().values().append(
                    spreadsheetId=sid,
                    range='Bookings!A:V',
                    valueInputOption='USER_ENTERED',
                    body={'values': [row]},
                ).execute()
                sheets_ok = True
        except Exception as e:
            logging.error(f'Sheet write: {e}')

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
            'success': sheets_ok,
            'sheets_stored': sheets_ok,
            'email_sent': email_ok,
            'total': total,
            'days': days,
        }
    except Exception as e:
        logging.error(f'create_booking tool error: {e}')
        return {
            'booking_id': None,
            'success': False,
            'message': f'Booking creation failed: {e}. Please try again.',
        }


def _send_gmail(to, subject, html_body, text_body=''):
    """Send an email via Gmail API using the service account."""
    if not to:
        return False
    try:
        svc = _get_gmail()
        if not svc:
            return False
        import base64 as b64
        from email.mime.text import MIMEText

        msg = MIMEText(html_body or text_body, 'html')
        msg['to'] = to
        msg['from'] = _company_email()
        msg['subject'] = subject

        raw = b64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        svc.users().messages().send(
            userId='me',
            body={'raw': raw},
        ).execute()
        logging.info(f'Email sent to {to}: {subject}')
        return True
    except Exception as e:
        logging.error(f'Gmail API failed for {to}: {e}')
        return False


def _send_emails(b_id, name, email, vehicle, pu_d, pu_t, re_d, re_t,
                 days, total, lic_num, lic_exp, lic_iss, pm):
    cname = _company()
    cemail = _company_email()
    cphone = _company_phone()
    oemail = _owner_email()
    subject = f"Booking Confirmation \u2014 {cname} (Ref: {b_id})"

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #2d2d2d;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:28px 40px 24px;border-bottom:4px solid #FFCC00;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 46" style="vertical-align:middle;margin-right:10px;"><path fill="#FFCC00" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>
        <span style="font-size:28px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:-0.5px;vertical-align:middle;">{_escape_html(cname)}</span>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <span style="font-size:12px;color:#FFCC00;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Car Rental</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Confirmed Bar -->
  <tr><td style="background:#FFCC00;padding:14px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;">&#10003;&nbsp; Booking Confirmed</td>
    </tr></table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:32px 40px 8px;">
    <p style="margin:0;font-size:18px;color:#1a1a1a;font-weight:700;">Hi {_escape_html(name)},</p>
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
            <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_escape_html(vehicle)}</div>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid #f5f5f0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Pick-up</div>
                <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_format_date_display(pu_d)}</div>
                <div style="font-size:13px;color:#5c5c5c;margin-top:2px;">{_escape_html(pu_t)}</div>
              </td>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#5c5c5c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Return</div>
                <div style="font-size:15px;color:#1a1a1a;font-weight:700;margin-top:4px;">{_format_date_display(re_d)}</div>
                <div style="font-size:13px;color:#5c5c5c;margin-top:2px;">{_escape_html(re_t)}</div>
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

  <!-- License Info -->
  <tr><td style="padding:0 40px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #2d2d2d;">
      <tr><td style="background:#f5f5f0;padding:10px 20px;border-bottom:2px solid #2d2d2d;">
        <span style="font-size:12px;color:#5c5c5c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">License on File</span>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <span style="font-size:14px;color:#1a1a1a;font-weight:600;">{_escape_html(lic_num)}</span>
        <span style="font-size:13px;color:#5c5c5c;margin:0 8px;">&bull;</span>
        <span style="font-size:13px;color:#5c5c5c;">Exp {_escape_html(lic_exp)}</span>
        <span style="font-size:13px;color:#5c5c5c;margin:0 8px;">&bull;</span>
        <span style="font-size:13px;color:#5c5c5c;">{_escape_html(lic_iss)}</span>
      </td></tr>
    </table>
  </td></tr>

  <!-- Booking Summary -->
  <tr><td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #2d2d2d;">
      <tr><td style="background:#1a1a1a;padding:12px 20px;">
        <span style="color:#FFCC00;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Booking Summary</span>
      </td></tr>
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#5c5c5c;">Reference</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:700;text-align:right;">{_escape_html(b_id)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#5c5c5c;">Vehicle</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;">{_escape_html(vehicle)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#5c5c5c;">Duration</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;">{days} day(s)</td>
          </tr>
          <tr><td colspan="2" style="padding:8px 0;"><div style="border-top:2px solid #2d2d2d;"></div></td></tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:700;">Total Due</td>
            <td style="padding:6px 0;font-size:22px;color:#1a1a1a;font-weight:800;text-align:right;">Bds${total:.2f}</td>
          </tr>
        </table>
        <div style="margin-top:12px;padding:10px 14px;background:#f5f5f0;border:1px solid #e0e0e0;">
          <span style="font-size:12px;color:#5c5c5c;">Pay at pick-up &mdash; Cash or Card accepted</span>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Pay Online -->
  <tr><td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #2d2d2d;">
      <tr><td style="background:#1a1a1a;padding:12px 20px;">
        <span style="color:#FFCC00;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Pay Online</span>
      </td></tr>
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#5c5c5c;line-height:1.5;">Scan the QR code below to pay via <strong>CIBC 1stPay</strong></p>
        <img src="https://storage.googleapis.com/donsrental-license-photos/cibc-1stpay-qr.png" alt="CIBC 1stPay QR Code" width="220" style="display:block;margin:0 auto;border:2px solid #2d2d2d;" />
        <p style="margin:12px 0 0;font-size:12px;color:#999;">Include your booking reference in the payment memo</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1a1a1a;padding:24px 40px;border-top:4px solid #FFCC00;">
    <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
      {_escape_html(cname)} &bull; {_escape_html(cphone)}<br>
      <a href="mailto:{_escape_html(cemail)}" style="color:#FFCC00;text-decoration:none;">{_escape_html(cemail)}</a>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#666;">
      <a href="https://onlineverywhere.com/privacy" style="color:#FFCC00;text-decoration:none;">Privacy Policy</a>
      &nbsp;&bull;&nbsp;
      <a href="https://onlineverywhere.com/terms" style="color:#FFCC00;text-decoration:none;">Terms &amp; Conditions</a>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#666;">Thank you for choosing us. Safe travels!</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

    text_body = f"""{cname} \u2014 Booking Confirmation

Reference: {b_id}
Customer: {name}
Vehicle: {vehicle}
Pick-up: {_format_date_display(pu_d)} at {pu_t}
Return: {_format_date_display(re_d)} at {re_t}
Duration: {days} day(s)
Total Due: Bds${total:.2f}

Payment: Pay when you pick up the vehicle. We accept cash and card.

License: {lic_num} (exp {lic_exp}) \u2022 {lic_iss}

{cname} \u2022 {cphone} \u2022 {cemail}"""

    email_ok = _send_gmail(email, subject, html_body, text_body)

    if oemail:
        osubject = f"New Booking: {name} \u2014 {vehicle} ({b_id})"
        otext = f"""New booking received!

Reference: {b_id}
Customer: {name}
Email: {email}
Vehicle: {vehicle}
Pick-up: {_format_date_display(pu_d)} at {pu_t}
Return: {_format_date_display(re_d)} at {re_t}
Duration: {days} day(s)
Total: Bds${total:.2f}
License: {lic_num} (exp {lic_exp})"""
        _send_gmail(oemail, osubject, otext, otext)

    topic = _env('NTFY_TOPIC')
    if topic:
        try:
            body = f'New Booking: {name} booked {vehicle} from {pu_d} to {re_d}. Total: Bds${total:.2f}. Ref: {b_id}'
            req = Request(
                f'https://ntfy.sh/{topic}',
                data=body.encode(),
                headers={'Title': f'New Booking - {name}', 'Priority': 'high'},
            )
            urlopen(req, timeout=5)
        except URLError:
            pass

    return email_ok


# ══════════════════════════════════════════
#  AGENT DEFINITION
# ══════════════════════════════════════════

def _build_instruction(ctx=None):
    today = date.today().isoformat()
    return f"""
You are a friendly car rental booking assistant for {_company()}, based in Barbados.

VEHICLE & PRICING:
- Call get_vehicles() to see current vehicles and rates, and use the returned vehicle and rate.
- Minimum 2-day rental. Weekend specials and weekly discounts available.
- All prices are in Barbados dollars (Bds$).

DATE HANDLING — you MUST resolve natural language into YYYY-MM-DD dates:
Today is {today}.
When the customer says something like:
- "this week" → use this Mon-Fri (Mon to Fri of the current week)
- "next week" → use next Mon-Fri
- "this weekend" → use this Saturday to Sunday
- "next weekend" → use next Saturday to Sunday
- "this month" → use 1st to last day of the current month
- "next month" → use 1st to last day of next month
- "tomorrow" → use tomorrow's date
- "for a week" → pickup today/tomorrow, return 7 days later
- "for a few days" → ask which specific days, or suggest 3-day minimum
Always resolve dates to YYYY-MM-DD format. Always confirm the exact dates back
to the customer after resolving them (e.g. "So that's Monday March 3 to Friday March 7").

FINDING AVAILABLE DATES — when the user gives a DURATION without specific dates:
  1. Call find_available_dates(vehicle_id=ID, duration_days=N), using the ID from get_vehicles().
  2. The tool checks both Google Sheets bookings AND Google Calendar for real availability.
  3. Present the returned available date windows to the user as options.
  4. Format the output with [AVAILABLE_DATES] so the frontend can render interactive chips.
  Example: User says "I need a car for 3 days" → call get_vehicles(), then call find_available_dates(vehicle_id=ID, duration_days=3)
  Then present the results like:
  "Here are the nearest available 3-day windows:
  [AVAILABLE_DATES]
  Sep 10 (Thu) to Sep 12 (Sat) | Sep 13 (Sun) to Sep 15 (Tue) | Sep 17 (Wed) to Sep 19 (Fri)
  [/AVAILABLE_DATES]
  Which works best for you?"

BOOKING FLOW — guide the customer step by step:
  1. Greet them and ask what dates they need the car.
  2. If they give specific dates, call check_availability to verify.
     If they give a duration, call find_available_dates to show open slots.
  3. Once dates are confirmed, show the vehicle info and total price.
  4. Ask for their name, email, and phone number.
  5. Ask for their driver's license number and expiry date.
  6. Confirm ALL details before booking — summarize everything.
  7. Call create_booking. If not available, suggest alternatives.
  8. Share the booking reference and confirm an invoice was emailed.

SUGGESTIONS — end every response with a [SUGGESTIONS] line.
These MUST help move the conversation forward. Pick the NEXT logical step:
  - If asking for dates → suggest common options like "This weekend", "Next week", "3 days starting soon"
  - If dates confirmed → suggest "My name is...", "What's included?", "Book it now"
  - If collecting info → suggest what info to provide next
  - If confirming → suggest "Yes, book it" or "Let me change something"
Format: [SUGGESTIONS] Option 1 | Option 2 | Option 3
Never suggest something they already answered. Never suggest something that halts progress.

IMPORTANT RULES:
- If they ask something unrelated (weather, directions, etc.), briefly answer then redirect.
- Keep responses short and friendly. Use Bds$ for prices.
- Never make up details — use your tools to check real data.
- Never ask for pickup/dropoff times — default to 09:00 and only change if they specify.
- Always use find_available_dates when the user mentions a duration rather than specific dates.
"""
agent = LlmAgent(
    name="rental_booking_agent",
    model="gemini-2.5-flash",
    instruction=_build_instruction,
    tools=[get_vehicles, find_available_dates, scan_license, check_availability, create_booking],
)
