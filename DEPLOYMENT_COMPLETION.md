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
cd <repo-root>

# Read credentials from .env (safe parsing for JSON values)
export GOOGLE_SHEETS_CREDENTIALS=$(grep -E '^GOOGLE_SHEETS_CREDENTIALS=' .env | sed 's/^GOOGLE_SHEETS_CREDENTIALS=//')

# Update Cloud Run
gcloud run services update donsrental \
  --region=europe-west1 \
  --update-env-vars=GOOGLE_SHEETS_CREDENTIALS="${GOOGLE_SHEETS_CREDENTIALS}"
```

### Option C: deploy-cloudrun.sh (from local machine)

```bash
cd <repo-root>
export AGENT_ENGINE='projects/282546523551/locations/us-central1/reasoningEngines/4084942433152925696'
./deploy-cloudrun.sh
```

This reads `GOOGLE_SHEETS_CREDENTIALS` from `.env` and passes it to Cloud Run.

---

## Step 2: Create Secrets in Secret Manager (for Cloud Build & Cloud Run)

Cloud Build and Cloud Run use Secret Manager for sensitive values. Create the secrets:

```bash
cd <repo-root>

# Read credentials from .env (safe parsing for JSON values)
export GOOGLE_SHEETS_CREDENTIALS=$(grep -E '^GOOGLE_SHEETS_CREDENTIALS=' .env | sed 's/^GOOGLE_SHEETS_CREDENTIALS=//')
export GEMINI_API_KEY=$(grep -E '^GEMINI_API_KEY=' .env | sed 's/^GEMINI_API_KEY=//')

# Create google-sheets-credentials secret (first time only)
echo -n "${GOOGLE_SHEETS_CREDENTIALS}" | \
  gcloud secrets create google-sheets-credentials \
    --data-file=- \
    --project=renal-car-booking

# If secret already exists, add a new version:
echo -n "${GOOGLE_SHEETS_CREDENTIALS}" | \
  gcloud secrets versions add google-sheets-credentials \
    --data-file=- \
    --project=renal-car-booking

# Create gemini-api-key secret and add version 2 (matching cloudbuild.yaml reference)
echo -n "${GEMINI_API_KEY}" | \
  gcloud secrets create gemini-api-key \
    --data-file=- \
    --project=renal-car-booking

# Add version 2 if needed
echo -n "${GEMINI_API_KEY}" | \
  gcloud secrets versions add gemini-api-key \
    --data-file=- \
    --project=renal-car-booking
```

### Grant Secret Access to Cloud Run Service Account

The Cloud Run service must be able to read these secrets. Grant the `secretAccessor` role:

```bash
# Get the Cloud Run service account (usually the default compute service account)
PROJECT_NUMBER=$(gcloud projects describe renal-car-booking --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to secrets
gcloud secrets add-iam-policy-binding google-sheets-credentials \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=renal-car-booking

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
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
cd <repo-root>/agent

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
| `GCS_BUCKET` | Cloud Run env | GCS bucket for license photos |
| `GCS_PHOTOS_PREFIX` | Cloud Run env | Path prefix for license photos in bucket |
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
cd <repo-root> && python -c "
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
