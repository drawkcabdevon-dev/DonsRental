# Deployment Completion Guide

## Current Status
- ✅ Backend reads/writes Google Sheets
- ✅ Frontend lint clean
- ✅ Python syntax OK
- ✅ End-to-end test passes (booking → Sheet)
- ✅ Apps Script created for email notifications
- ✅ GCS photo upload working (signed URLs)
- ✅ Secrets managed via Secret Manager
- ✅ Google Calendar integration (availability + events)
- ✅ Customer confirmation emails
- ✅ Owner notification emails with booking breakdown

---

## How Secrets Work

All secrets are stored in **Secret Manager** and injected into Cloud Run at deploy time via `--set-secrets` in `cloudbuild.yaml`. You do **NOT** need to set these as plain env vars.

| Secret | Secret Manager Name | Used By |
|--------|-------------------|---------|
| Gemini API Key | `gemini-api-key` | License OCR |
| Sheets Credentials | `google-sheets-credentials` | Google Sheets + Calendar |
| Calendar ID | `google-calendar-id` | Google Calendar availability |

---

## Deploy

```bash
cd /tmp/DonsRental
git checkout main
git pull
gcloud auth login
export AGENT_ENGINE="projects/450188951493/locations/us-central1/reasoningEngines/XXXXXXXXXXXXXX"
./deploy-cloudrun.sh
```

Cloud Build will:
1. Build the Docker image (frontend + backend)
2. Push to Artifact Registry
3. Deploy to Cloud Run with secrets from Secret Manager

---

## Verify Live Deployment

```bash
# Health check
curl https://rentals.onlineverywhere.com/api/health

# Vehicles (should come from Sheet)
curl https://rentals.onlineverywhere.com/api/vehicles

# Test availability check (includes calendar events)
curl -X POST https://rentals.onlineverywhere.com/api/check-availability \
  -H "Content-Type: application/json" \
  -d '{"pickupDate":"2026-08-20","returnDate":"2026-08-22","vehicleId":"v1"}'
```

---

## Install Apps Script for Emails

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
| `GOOGLE_CALENDAR_ID` | Secret Manager | Google Calendar ID |
| `AGENT_ENGINE` | Cloud Run env | Vertex AI Agent Engine resource |
| `GCS_BUCKET` | Cloud Run env | GCS bucket for license photos |
| `GCS_PHOTOS_PREFIX` | Cloud Run env | Path prefix for photos in bucket |

---

## One-Time Setup (already done)

These were configured during initial setup. Only needed once per project:

### Create Secret Manager secrets
```bash
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=- --project=renal-car-booking
echo -n '{"type":"service_account",...}' | gcloud secrets create google-sheets-credentials --data-file=- --project=renal-car-booking
echo -n "c_93b81d190fa2b719fee43b8f9e2335d20b29c0d2dc63dff3b96aa3f091d53450@group.calendar.google.com" | gcloud secrets create google-calendar-id --data-file=- --project=renal-car-booking
```

### Grant Cloud Run SA access to secrets
```bash
PROJECT_NUMBER=$(gcloud projects describe renal-car-booking --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for secret in gemini-api-key google-sheets-credentials google-calendar-id; do
  gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
done
```

### Grant Cloud Build SA access to secrets
```bash
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
for secret in gemini-api-key google-sheets-credentials google-calendar-id; do
  gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$CB_SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
done
```

### Grant Calendar Access to Service Account
1. Open [Google Calendar](https://calendar.google.com)
2. Settings → Settings for my calendars → select your calendar
3. **Share with specific people** → add `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com`
4. Give it **Make changes to events** permission

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
| `403 Forbidden` on Sheet API | Share Sheet with service account (Editor) |
| Bookings not writing to Sheet | Check Secret Manager secrets exist and Cloud Run SA has access |
| Vehicles showing hardcoded | Same as above — Sheets not connected |
| Emails not sending | Check Apps Script trigger installed, Gmail quota not exceeded |
| Calendar events not showing | Verify service account has "Make changes to events" on Calendar |
| `gcloud auth` fails | Run `gcloud auth login` with personal account |
| Cloud Run deploy permission | Ensure your user has `Cloud Run Admin` role |
