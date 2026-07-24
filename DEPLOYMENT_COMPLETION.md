# Deployment Completion Guide

## Current Status
- ✅ Backend reads/writes Google Sheets (tested locally)
- ✅ Frontend lint clean
- ✅ Python syntax OK
- ✅ End-to-end test passes (booking → Sheet)
- ✅ Apps Script created for email notifications
- ✅ GCS photo upload working (signed URLs)
- ✅ Secrets managed via Secret Manager

---

## How Secrets Work Now

Both `GEMINI_API_KEY` and `GOOGLE_SHEETS_CREDENTIALS` are stored in **Secret Manager** and injected into Cloud Run at deploy time via `--set-secrets` in `cloudbuild.yaml`. You do **NOT** need to set these as plain env vars.

| Secret | Secret Manager Name | Used By |
|--------|-------------------|---------|
| Gemini API Key | `gemini-api-key` | License OCR |
| Sheets Credentials | `google-sheets-credentials` | Google Sheets read/write |

---

## Step 1: Deploy (the only step you need)

```bash
cd DonsRental
git checkout main
git pull
gcloud auth login
SHORT_SHA=$(git rev-parse --short HEAD)
gcloud builds submit --config=cloudbuild.yaml --substitutions=SHORT_SHA="$SHORT_SHA"
```

Cloud Build will:
1. Build the Docker image (frontend + backend)
2. Push to Artifact Registry
3. Deploy to Cloud Run with secrets from Secret Manager

---

## Step 2: Verify Live Deployment

```bash
# Health check
curl https://rentals.onlineverywhere.com/api/health

# Vehicles (should come from Sheet)
curl https://rentals.onlineverywhere.com/api/vehicles

# Test upload-photo
python3 -c "
import base64, json
jpeg = bytes([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9])
b64 = base64.b64encode(jpeg).decode()
print(json.dumps({'image': b64}))
" | curl -s -X POST https://rentals.onlineverywhere.com/api/upload-photo -H "Content-Type: application/json" -d @-
```

---

## Step 3: Install Apps Script for Emails

See `APPS_SCRIPT_SETUP.md` for full instructions.

Quick version:
1. Open Sheet → Extensions → Apps Script
2. Paste `apps-script/booking-notifications.gs`
3. Run `setupTriggers()` → approve permissions

---

## Environment Variables Reference

| Variable | Set In | Purpose |
|----------|--------|---------|
| `GEMINI_API_KEY` | Secret Manager | License OCR via Gemini |
| `SPREADSHEET_ID` | Cloud Run env | Google Sheet ID |
| `GOOGLE_SHEETS_CREDENTIALS` | Secret Manager | Service account JSON |
| `OWNER_EMAIL` | Cloud Run env | Booking notifications |
| `AGENT_ENGINE` | Cloud Run env | Vertex AI Agent Engine resource |
| `GCS_BUCKET` | Cloud Run env | GCS bucket for license photos |
| `GCS_PHOTOS_PREFIX` | Cloud Run env | Path prefix for photos in bucket |

---

## One-Time Setup (already done)

These were configured during initial setup. Only needed once per project:

### Create Secret Manager secrets
```bash
# From .env file
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=- --project=renal-car-booking
echo -n "$GOOGLE_SHEETS_CREDENTIALS" | gcloud secrets create google-sheets-credentials --data-file=- --project=renal-car-booking
```

### Grant Cloud Run SA access to secrets
```bash
PROJECT_NUMBER=$(gcloud projects describe renal-car-booking --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding gemini-api-key --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
gcloud secrets add-iam-policy-binding google-sheets-credentials --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
```

### Grant Cloud Build SA access to secrets
```bash
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud secrets add-iam-policy-binding gemini-api-key --member="serviceAccount:$CB_SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
gcloud secrets add-iam-policy-binding google-sheets-credentials --member="serviceAccount:$CB_SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
```

---

## Quick Commands

```bash
# Check Cloud Run service
gcloud run services describe donsrental --region=europe-west1 --project=renal-car-booking

# View logs
gcloud run services logs read donsrental --region=europe-west1 --project=renal-car-booking --limit=50
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `403 Forbidden` on Sheet API | Share Sheet with `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com` (Editor) |
| Bookings not writing to Sheet | Check Secret Manager secrets exist and Cloud Run SA has access |
| Vehicles showing hardcoded | Same as above — Sheets not connected |
| Emails not sending | Check Apps Script trigger installed, Gmail quota not exceeded |
| `gcloud auth` fails | Run `gcloud auth login` with personal account |
| Cloud Run deploy permission | Ensure your user has `Cloud Run Admin` role |
