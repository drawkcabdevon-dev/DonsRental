# Deployment Checklist

## Prerequisites (run locally, one-time)

```bash
# 1. Authenticate gcloud (requires browser)
gcloud auth login
gcloud auth application-default login
gcloud config set project renal-car-booking

# 2. Verify
gcloud auth list
gcloud auth application-default print-access-token
```

---

## Step 1: Create Secret Manager Secrets (one-time)

```bash
# Gemini API Key (get from https://aistudio.google.com)
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=- --project=renal-car-booking

# Google Sheets Credentials (service account JSON)
echo -n '{"type":"service_account",...}' | gcloud secrets create google-sheets-credentials --data-file=- --project=renal-car-booking

# Google Calendar ID
echo -n "c_93b81d190fa2b719fee43b8f9e2335d20b29c0d2dc63dff3b96aa3f091d53450@group.calendar.google.com" | gcloud secrets create google-calendar-id --data-file=- --project=renal-car-booking
```

---

## Step 2: Grant Secret Access to Cloud Run & Cloud Build

```bash
PROJECT_NUMBER=$(gcloud projects describe renal-car-booking --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for secret in gemini-api-key google-sheets-credentials google-calendar-id; do
  gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
  gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$CB_SA" --role=roles/secretmanager.secretAccessor --project=renal-car-booking
done
```

---

## Step 3: Grant Calendar Access to Service Account

1. Open [Google Calendar](https://calendar.google.com)
2. Settings → Settings for my calendars → select your calendar
3. **Share with specific people** → add `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com`
4. Give it **Make changes to events** permission

---

## Step 4: Deploy Agent to Vertex AI Agent Engine

```bash
cd /tmp/DonsRental/agent
python3 deploy.py --auto
```

**Expected output:**
```
✅  DEPLOYED SUCCESSFULLY!
Resource Name: projects/450188951493/locations/us-central1/reasoningEngines/XXXXXXXXXXXXXX
```

**Copy the Resource Name** — you'll need it for Cloud Run.

---

## Step 5: Deploy Backend to Cloud Run

```bash
cd /tmp/DonsRental
export AGENT_ENGINE="projects/450188951493/locations/us-central1/reasoningEngines/XXXXXXXXXXXXXX"
./deploy-cloudrun.sh
```

**Expected output:**
```
✅  DEPLOYED!
   URL: https://donsrental-XXXXXXXXXXXXXX-ew.a.run.app
```

---

## Step 6: Verify Deployment

```bash
# Health check
curl https://donsrental-XXXXXXXXXXXXXX-ew.a.run.app/api/health

# Vehicles (should read from Sheet)
curl https://donsrental-XXXXXXXXXXXXXX-ew.a.run.app/api/vehicles

# Test booking
curl -X POST https://donsrental-XXXXXXXXXXXXXX-ew.a.run.app/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"v1","customerName":"Test User","customerEmail":"test@example.com","customerPhone":"555-1234","customerAddress":"123 Test St","pickupDate":"2026-08-20","pickupTime":"10:00","returnDate":"2026-08-22","returnTime":"10:00","licenseNumber":"TEST123","licenseExpiry":"2030-01-01","licenseIssuer":"Barbados Licensing Authority","licenseClass":"B","totalDays":2,"totalCost":240}'
```

---

## Step 7: Install Apps Script for Email Notifications

1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0/edit
2. **Extensions > Apps Script**
3. Delete any existing code, paste contents of `apps-script/booking-notifications.gs`
4. Save (Ctrl+S), name: "Don's Rental Notifications"
5. Run `setupTriggers()` → approve permissions
6. Test: add a row to `Bookings` tab with `status=Confirmed` and `custEmail=your@email.com`

---

## Quick Reference

| Component | URL/Location |
|-----------|-------------|
| Live App | https://donsrental-wof62rve3a-ew.a.run.app |
| Google Sheet | https://docs.google.com/spreadsheets/d/1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0/edit |
| Apps Script | Extensions > Apps Script (in Sheet) |
| Cloud Run Console | https://console.cloud.google.com/run/detail/europe-west1/donsrental |
| Vertex AI Agent Engine | https://console.cloud.google.com/vertex-ai/agents/reasoning-engines |
| Secret Manager | https://console.cloud.google.com/security/secret-manager?project=renal-car-booking |

---

## Secrets in Secret Manager

| Secret | Purpose |
|--------|---------|
| `gemini-api-key` | License OCR via Gemini |
| `google-sheets-credentials` | Service account JSON for Sheets/Calendar |
| `google-calendar-id` | Google Calendar ID for availability |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Default credentials not found" | Run `gcloud auth application-default login` |
| "Permission denied on Cloud Run" | Ensure you're using YOUR gcloud auth, not service account |
| Agent deploy fails | Add `cloudpickle` to agent/requirements.txt |
| Emails not sending | Check Apps Script trigger installed, Gmail quota not exceeded |
| Sheet not updating | Verify service account has Editor access to Sheet |
| Calendar events not showing | Verify service account has "Make changes to events" on Calendar |
| `gcloud auth` fails | Run `gcloud auth login` with personal account |
