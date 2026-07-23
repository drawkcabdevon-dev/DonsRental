# Don's Rental — Car Booking System

A self-service car rental booking system for Barbados.

## Architecture

```
frontend/       ← React 19 + Vite + TypeScript SPA (5-step booking flow)
backend/        ← FastAPI Cloud Run service (proxies to Agent Engine, reads/writes Sheets)
agent/          ← ADK agent deployed to Vertex AI Agent Engine (chat interface)
Google Sheets   ← Vehicles tab + Bookings tab (persistent data store)
Apps Script     ← Triggers email notifications on booking creation
```

## How it works

1. Customer opens the booking site → selects vehicle → picks dates → uploads license → enters info → confirms
2. Backend writes booking to **Google Sheets** (`Bookings` tab)
3. Backend reads vehicles from **Google Sheets** (`Vehicles` tab)
4. Backend checks availability against existing bookings in the Sheet
5. **Apps Script** triggers on Sheet edit → sends confirmation email to customer + notification to owner
6. Chat interface (via Agent Engine) also reads/writes the same Sheet

## Live Site

- **URL:** https://rentals.onlineverywhere.com
- **Backend:** Cloud Run (europe-west1)
- **Agent:** Vertex AI Agent Engine

## Deployment

See `DEPLOYMENT_COMPLETION.md` for step-by-step instructions.

## Quick Start (Local)

```bash
# 1. Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install

# 2. Set up .env (copy from .env.example and fill in values)
cp .env.example .env

# 3. Run backend
cd backend && uvicorn main:app --reload --port 8000

# 4. Run frontend (separate terminal)
cd frontend && npm run dev
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | License OCR via Gemini API |
| `SPREADSHEET_ID` | Yes | Google Sheet ID |
| `GOOGLE_SHEETS_CREDENTIALS` | Yes | Service account JSON (full, one line) |
| `OWNER_EMAIL` | Yes | Booking notification emails |
| `AGENT_ENGINE` | Yes | Vertex AI Agent Engine resource |
| `SENDGRID_API_KEY` | No | Email fallback (optional) |
| `VITE_API_BASE` | No | Frontend API URL (default: http://localhost:8000/api) |

**Critical:** `GOOGLE_SHEETS_CREDENTIALS` must be the **entire service account JSON** as a single-line string, not just the key ID.

## Files

| Path | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, Sheets integration, booking endpoints |
| `agent/main.py` | ADK agent + tools (get_vehicles, scan_license, check_availability, create_booking) |
| `agent/deploy.py` | Deploy agent to Vertex AI Agent Engine |
| `frontend/src/` | React SPA with 5-step booking flow |
| `apps-script/booking-notifications.gs` | Google Apps Script for email notifications |
| `deploy-cloudrun.sh` | Deploy to Cloud Run |
| `cloudbuild.yaml` | Cloud Build config (auto-deploys on push) |
| `.env` | Secrets (DO NOT COMMIT) |
