# Deployment Completion Checklist

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

## Step 1: Deploy Agent to Vertex AI Agent Engine

```bash
cd /workspaces/DonsRental/agent
python deploy.py --auto
```

**Expected output:**
```
Deploying to onlineeverywhere / us-central1...
Uploading to Agent Engine (this takes ~2 minutes)...
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

**Expected output:**
```
================================================
 Don's Rental — Cloud Run Deploy
 Project:    renal-car-booking
 Region:     us-central1
 Service:    dons-rental
 Agent Eng:  projects/.../reasoningEngines/XXXXXXXXXXXXXX
================================================

✅  DEPLOYED!
   URL: https://dons-rental-XXXXXXXXXXXXXX-uc.a.run.app
```

---

## Step 3: Verify Deployment

```bash
# Health check
curl https://dons-rental-XXXXXXXXXXXXXX-uc.a.run.app/api/health

# Vehicles (should read from Sheet)
curl https://dons-rental-XXXXXXXXXXXXXX-uc.a.run.app/api/vehicles

# Test booking
curl -X POST https://dons-rental-XXXXXXXXXXXXXX-uc.a.run.app/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"v1","customerName":"Test User","customerEmail":"test@example.com","customerPhone":"555-1234","customerAddress":"123 Test St","pickupDate":"2026-08-20","pickupTime":"10:00","returnDate":"2026-08-22","returnTime":"10:00","licenseNumber":"TEST123","licenseExpiry":"2030-01-01","licenseIssuer":"Barbados Licensing Authority","licenseClass":"B","totalDays":2,"totalCost":240}'
```

---

## Step 4: Install Apps Script for Email Notifications

1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0/edit
2. **Extensions > Apps Script**
3. Paste contents of `apps-script/booking-notifications.gs`
4. Save (Ctrl+S), name: "Don's Rental Notifications"
5. Run `setupTriggers()` ▶️ → approve permissions
5. Test: add a row to `Bookings` tab with `status=Confirmed` and `custEmail=your@email.com`

---

## Step 5: Update cloudbuild.yaml (optional, for CI/CD)

After Step 1, update the `_AGENT_ENGINE` substitution in `cloudbuild.yaml` with the new resource name.

---

## Quick Reference

| Component | URL/Location |
|-----------|-------------|
| Google Sheet | https://docs.google.com/spreadsheets/d/1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0/edit |
| Apps Script | Extensions > Apps Script (in Sheet) |
| Cloud Run Console | https://console.cloud.google.com/run/detail/us-central1/dons-rental |
| Vertex AI Agent Engine | https://console.cloud.google.com/vertex-ai/agents/reasoning-engines |
| .env file | `/workspaces/DonsRental/.env` (DO NOT COMMIT) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Default credentials not found" | Run `gcloud auth application-default login` |
| "Permission denied on Cloud Run" | Ensure you're using YOUR gcloud auth, not service account |
| Agent deploy fails on requirements | Add `cloudpickle` to agent/requirements.txt |
| Emails not sending from Apps Script | Check Gmail quota (100/day free), verify `OWNER_EMAIL` |
| Sheet not updating | Verify service account `dons-rental-sheets@renal-car-booking.iam.gserviceaccount.com` has Editor access |

---

## Files Created/Modified

- `apps-script/booking-notifications.gs` — Email notifications via Apps Script
- `APPS_SCRIPT_SETUP.md` — Detailed Apps Script installation guide
- `DEPLOYMENT_CHECKLIST.md` — This file