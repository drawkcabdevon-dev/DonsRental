# Deployment Completion Checklist

## Current Status
- ✅ Backend reads/writes Google Sheets (tested locally)
- ✅ Frontend lint clean
- ✅ Python syntax OK
- ✅ End-to-end test passes (booking → Sheet)
- ✅ Apps Script created for email notifications
- ⚠️ **Agent Engine deployment** — needs local `gcloud auth`
- ⚠️ **Cloud Run deployment** — needs local `gcloud auth`

---

## Prerequisites (run once locally)

```bash
# 1. Authenticate gcloud (requires browser)
gcloud auth login
gcloud auth application-default login
gcloud config set project renal-car-booking

# 2. Verify auth works
gcloud auth list
gcloud auth application-default print-access-token
```

---

## Step 1: Deploy Agent to Vertex AI Agent Engine

```bash
cd /workspaces/DonsRental/agent
python deploy.py --auto
```

**Expected output:**
```
Deploying to onlineeverywhere / us-central1...
Uploading to Agent Engine (this takes ~2 minutes)...
Requirements: [...]
✅  DEPLOYED SUCCESSFULLY!
Resource Name: projects/450188951493/locations/us-central1/reasoningEngines/XXXXXXXXXXXXXX
```

**Copy the Resource Name** — you'll need it for Cloud Run.

---

## Step 2: Deploy Backend to Cloud Run

```bash
cd /workspaces/DonsRental
export AGENT_ENGINE="projects/450188951493/locations/us-central1/reasoningEngines/XXXXXXXXXXXXXX"
./deploy-cloudrun.sh
```

**What this does:**
- Builds Docker image (frontend + backend)
- Pushes to Artifact Registry
- Deploys to Cloud Run with env vars:
  - `AGENT_ENGINE` (from export)
  - `SPREADSHEET_ID` (from .env)
  - `OWNER_EMAIL` (from .env)
  - `GOOGLE_CLOUD_PROJECT`
  - `GOOGLE_CLOUD_LOCATION`

---

## Step 3: Update Cloud Build (optional)

If using Cloud Build instead of deploy script:

```bash
# Update the _AGENT_ENGINE substitution in cloudbuild.yaml
# Then:
gcloud builds submit --config cloudbuild.yaml .
```

---

## Step 4: Verify Live Deployment

```bash
# Health check
curl https://rentals.onlineverywhere.com/api/health

# Vehicles (should come from Sheet)
curl https://rentals.onlineverywhere.com/api/vehicles

# Test booking
curl -X POST https://rentals.onlineverywhere.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"v1","customerName":"Live Test","customerEmail":"test@example.com","customerPhone":"555-1234","customerAddress":"123 Test St","pickupDate":"2026-08-20","pickupTime":"10:00","returnDate":"2026-08-22","returnTime":"10:00","licenseNumber":"LIVE123","licenseExpiry":"2030-01-01","licenseIssuer":"Barbados Licensing Authority","licenseClass":"B","totalDays":2,"totalCost":240}'
```

**Verify in Sheet:** Check the `Bookings` tab for the new row.

---

## Step 5: Install Apps Script for Emails

See `APPS_SCRIPT_SETUP.md` for full instructions.

Quick version:
1. Open Sheet → Extensions → Apps Script
2. Paste `apps-script/booking-notifications.gs`
3. Run `setupTriggers()` → approve permissions

---

## Environment Variables Reference

| Variable | Set In | Purpose |
|----------|--------|---------|
| `GEMINI_API_KEY` | `.env`, Cloud Run secret | License OCR via Gemini |
| `SPREADSHEET_ID` | `.env`, Cloud Run env | Google Sheet ID |
| `GOOGLE_SHEETS_CREDENTIALS` | `.env` (JSON) | Service account for Sheets API |
| `OWNER_EMAIL` | `.env`, Cloud Run env | Booking notifications |
| `AGENT_ENGINE` | Cloud Run env (deploy time) | Vertex AI Agent Engine resource |
| `SENDGRID_API_KEY` | `.env` (optional) | Email fallback |

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `.env` | All secrets filled |
| `backend/main.py` | Sheets integration (vehicles, bookings, availability) |
| `deploy-cloudrun.sh` | Passes `SPREADSHEET_ID`, `OWNER_EMAIL` |
| `cloudbuild.yaml` | Sets `_OWNER_EMAIL` substitution |
| `apps-script/booking-notifications.gs` | Sheet-based email notifications |
| `APPS_SCRIPT_SETUP.md` | This file |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `gcloud auth application-default login` fails | Use personal account, not service account |
| Cloud Run deploy permission denied | Ensure your user has `Cloud Run Admin`, `Cloud Build Editor` roles |
| Agent Engine deploy fails | Enable Vertex AI API: `gcloud services enable aiplatform.googleapis.com` |
| Sheet writes fail (403) | Share Sheet with `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com` (Editor) |
| Emails not sending | Check Apps Script trigger installed, Gmail quota not exceeded |

---

## Quick Commands

```bash
# Check Cloud Run service
gcloud run services describe donsrental --region=us-central1 --project=renal-car-booking

# View logs
gcloud run services logs read donsrental --region=us-central1 --project=renal-car-booking --limit=50

# Re-deploy backend only
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