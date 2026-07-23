# Deployment Completion Guide

## Current Status
- ✅ Backend reads/writes Google Sheets (tested locally)
- ✅ Frontend lint clean
- ✅ Python syntax OK
- ✅ End-to-end test passes (booking → Sheet)
- ✅ Apps Script created for email notifications
- ⚠️ **Cloud Run** — needs `GOOGLE_SHEETS_CREDENTIALS` env var set

---

## Critical Issue: Missing GOOGLE_SHEETS_CREDENTIALS

The live site at https://rentals.onlineverywhere.com **cannot read/write Google Sheets** because the `GOOGLE_SHEETS_CREDENTIALS` env var is not set in Cloud Run.

**Why:** The `.env` file is gitignored and not deployed. Only env vars passed via `--set-env-vars` are available in Cloud Run.

---

## Step 1: Set GOOGLE_SHEETS_CREDENTIALS in Cloud Run

### Option A: Google Cloud Console (easiest)

1. Go to **https://console.cloud.google.com/run**
2. Click **donsrental** service
3. Click **Edit & deploy new revision**
4. Scroll to **Environment variables**
5. Click **Add variable**
6. Name: `GOOGLE_SHEETS_CREDENTIALS`
7. Value: paste the **entire JSON** from your `.env` file:

```bash
# To get the value, run locally:
grep GOOGLE_SHEETS_CREDENTIALS .env | cut -d= -f2-
```

8. Click **Deploy**

### Option B: gcloud CLI (from local machine)

```bash
cd /workspaces/DonsRental

# Read credentials from .env
export $(grep GOOGLE_SHEETS_CREDENTIALS .env | xargs)

# Update Cloud Run
gcloud run services update donsrental \
  --region=europe-west1 \
  --update-env-vars=GOOGLE_SHEETS_CREDENTIALS="${GOOGLE_SHEETS_CREDENTIALS}"
```

### Option C: deploy-cloudrun.sh (from local machine)

```bash
cd /workspaces/DonsRental
export AGENT_ENGINE='projects/282546523551/locations/us-central1/reasoningEngines/4084942433152925696'
./deploy-cloudrun.sh
```

This reads `GOOGLE_SHEETS_CREDENTIALS` from `.env` and passes it to Cloud Run.

---

## Step 2: Create Secret in Secret Manager (for Cloud Build)

Cloud Build uses Secret Manager for sensitive values. Create the secret:

```bash
cd /workspaces/DonsRental

# Read credentials from .env
export $(grep GOOGLE_SHEETS_CREDENTIALS .env | xargs)

# Create the secret (first time only)
echo -n "${GOOGLE_SHEETS_CREDENTIALS}" | \
  gcloud secrets create google-sheets-credentials \
    --data-file=- \
    --project=renal-car-booking

# If secret already exists, add a new version:
echo -n "${GOOGLE_SHEETS_CREDENTIALS}" | \
  gcloud secrets versions add google-sheets-credentials \
    --data-file=- \
    --project=renal-car-booking
```

---

## Step 3: Verify Live Deployment

```bash
# Health check
curl https://rentals.onlineverywhere.com/api/health

# Vehicles (should come from Sheet)
curl https://rentals.onlineverywhere.com/api/vehicles

# Test booking
curl -X POST https://rentals.onlineverywhere.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "v1",
    "customerName": "Live Test",
    "customerEmail": "test@example.com",
    "customerPhone": "555-1234",
    "customerAddress": "123 Test St",
    "pickupDate": "2026-08-20",
    "pickupTime": "10:00",
    "returnDate": "2026-08-22",
    "returnTime": "10:00",
    "licenseNumber": "LIVE123",
    "licenseExpiry": "2030-01-01",
    "licenseIssuer": "Barbados Licensing Authority",
    "licenseClass": "B",
    "totalDays": 2,
    "totalCost": 240
  }'
```

**Verify in Sheet:** Check the `Bookings` tab for the new row.

---

## Step 4: Install Apps Script for Emails

See `APPS_SCRIPT_SETUP.md` for full instructions.

Quick version:
1. Open Sheet → Extensions → Apps Script
2. Paste `apps-script/booking-notifications.gs`
3. Run `setupTriggers()` → approve permissions

---

## Step 5: Deploy Agent to Agent Engine (optional)

This requires browser authentication and must be run from a local machine:

```bash
cd /workspaces/DonsRental/agent

# Authenticate (requires browser)
gcloud auth application-default login

# Deploy
python deploy.py --auto

# Copy the Resource Name from output, then update cloudbuild.yaml:
# _AGENT_ENGINE: projects/.../locations/us-central1/reasoningEngines/XXXXXXXX
```

---

## Environment Variables Reference

| Variable | Set In | Purpose |
|----------|--------|---------|
| `GEMINI_API_KEY` | Secret Manager | License OCR via Gemini |
| `SPREADSHEET_ID` | Cloud Run env | Google Sheet ID |
| `GOOGLE_SHEETS_CREDENTIALS` | Secret Manager or Cloud Run env | Service account JSON |
| `OWNER_EMAIL` | Cloud Run env | Booking notifications |
| `AGENT_ENGINE` | Cloud Run env | Vertex AI Agent Engine resource |
| `VITE_API_BASE` | Frontend build | API URL (default: http://localhost:8000/api) |

---

## Quick Commands

```bash
# Check Cloud Run service
gcloud run services describe donsrental --region=europe-west1 --project=renal-car-booking

# View logs
gcloud run services logs read donsrental --region=europe-west1 --project=renal-car-booking --limit=50

# Re-deploy backend
export AGENT_ENGINE='projects/282546523551/locations/us-central1/reasoningEngines/4084942433152925696'
./deploy-cloudrun.sh

# Test local backend with .env
cd /workspaces/DonsRental && python -c "
import os
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k] = v
os.chdir('backend')
import uvicorn
uvicorn.run('main:app', host='0.0.0.0', port=8000)
"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `403 Forbidden` on Sheet API | Share Sheet with `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com` (Editor) |
| Bookings not writing to Sheet | Set `GOOGLE_SHEETS_CREDENTIALS` in Cloud Run (see Step 1) |
| Vehicles showing hardcoded | Same as above — Sheets not connected |
| Emails not sending | Check Apps Script trigger installed, Gmail quota not exceeded |
| `gcloud auth` fails | Use personal account, not service account |
| Cloud Run deploy permission | Ensure your user has `Cloud Run Admin` role |
