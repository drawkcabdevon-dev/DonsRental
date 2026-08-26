# Don's Rental — Car Booking System

A self-service car rental booking system for Barbados. Built by [OnlineVeryWhere](https://onlineverywhere.com).

## Architecture

```
frontend/       ← React 19 + Vite + TypeScript SPA (animated landing + booking flow)
backend/        ← FastAPI Cloud Run service (Sheets, Calendar, profiles)
agent/          ← ADK agent deployed to Vertex AI Agent Engine (chat interface)
Google Sheets   ← Vehicles, Bookings, Profiles tabs (persistent data store)
Google Calendar ← Availability tracking (backend)
Apps Script     ← Time-driven trigger sends email notifications
```

## How it works

1. Customer opens the booking site → sees animated landing page with bolt branding → clicks "Book Now"
2. Interactive calendar shows green/red color-coded availability
3. Selects vehicle → picks dates/times → uploads license → enters info → reviews → confirms
4. Backend calculates cost server-side, writes booking to **Google Sheets** (`Bookings` tab)
5. Backend creates calendar event in **Google Calendar** (availability tracking)
6. **Apps Script** (time-driven, every 5 mins) checks for new bookings → sends confirmation email to customer + notification to owner
7. User profiles saved to `Profiles` sheet → auto-fill on next booking

## Live Site

- **URL:** https://rentals.onlineverywhere.com
- **Backend:** Cloud Run (europe-west1)
- **Agent:** Vertex AI Agent Engine

## Deployment

See `DEPLOYMENT_COMPLETION.md` for step-by-step instructions.

## Quick Start (Local)

```bash
# 1. Set up .env (copy from .env.example and fill in values)
cp .env.example .env

# 2. Install backend dependencies
(cd backend && pip install -r requirements.txt)

# 3. Install frontend dependencies
(cd frontend && npm install)

# 4. Run backend (from repository root)
(cd backend && uvicorn main:app --reload --port 8000)

# 5. Run frontend in separate terminal (from repository root)
(cd frontend && npm run dev)
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | License OCR via Gemini API |
| `SPREADSHEET_ID` | Yes | Google Sheet ID |
| `GOOGLE_SHEETS_CREDENTIALS` | Yes | Service account JSON (full, one line) |
| `GOOGLE_CALENDAR_ID` | Yes | Google Calendar for availability tracking |
| `OWNER_EMAIL` | No | Booking notification emails |
| `AGENT_ENGINE` | Yes | Vertex AI Agent Engine resource |
| `GCS_BUCKET` | Yes | GCS bucket for license photos |
| `GCS_PHOTOS_PREFIX` | Yes | Path prefix for license photos in bucket |
| `ADMIN_KEY` | Yes | API key for admin endpoints (stored in Secret Manager) |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | Google Sign-In OAuth client ID |
| `VITE_API_BASE` | No | Frontend API URL (default: http://localhost:8000/api) |

**Critical:** `GOOGLE_SHEETS_CREDENTIALS` must be the **entire service account JSON** as a single-line string, not just the key ID.

## Features

- **Animated Landing Page** — Motion graphic hero, bolt branding, marquee ticker, tabbed walkthrough
- **Color-Coded Calendar** — Green (available), red (booked), yellow (selected) with glow effects
- **Bolt Branding** — Yellow bolt icons (⚡) throughout, consistent black/yellow palette
- **Smooth Transitions** — AnimatePresence slide animations between booking steps
- **Google Sign-In** — Auto-fill profile data from previous bookings
- **6-Step Booking Flow** — Vehicle → Dates → License → Your Info → Review → Confirmed
- **Server-side Pricing** — Cost calculated from vehicle rate × days (never trusts client)
- **GSAP Animations** — Driving stepper, smooth transitions, motion design
- **Terms & Privacy** — Legal pages with acceptance checkbox
- **Toast Notifications** — Real-time user feedback
- **SEO** — Meta tags, Open Graph, JSON-LD, sitemap.xml

## Security

- Cloudflare Turnstile CAPTCHA on booking endpoint
- Rate limiting (10 bookings/min, 5 license scans/min)
- `GET /api/bookings` requires admin key (protects customer PII)
- CORS restricted to production domains
- Calendar events set to private visibility
- No PII logged to files
- Input validation via Pydantic

## Files

| Path | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, Sheets, Calendar, profiles, booking endpoints |
| `agent/main.py` | ADK agent + tools (get_vehicles, scan_license, check_availability, create_booking) |
| `agent/deploy.py` | Deploy agent to Vertex AI Agent Engine |
| `frontend/src/App.tsx` | Main booking app (6 steps, Google Sign-In, availability calendar) |
| `frontend/src/pages/LandingPage.tsx` | Animated landing page with bolt branding |
| `frontend/src/components/AvailabilityCalendar.tsx` | Custom interactive calendar component |
| `frontend/src/components/DrivingStepper.tsx` | GSAP-animated progress stepper |
| `frontend/src/services/api.ts` | Backend API integration (vehicles, bookings, profiles) |
| `frontend/src/pages/TermsAndConditions.tsx` | Terms & Conditions page |
| `frontend/src/pages/PrivacyPolicy.tsx` | Privacy Policy page |
| `frontend/src/pages/AdminDashboard.tsx` | Owner dashboard |
| `apps-script/booking-notifications.gs` | Google Apps Script (time-driven email notifications) |
| `deploy-cloudrun.sh` | Deploy to Cloud Run |
| `cloudbuild.yaml` | Cloud Build config (auto-deploys on push) |
| `.env` | Secrets (DO NOT COMMIT) |
