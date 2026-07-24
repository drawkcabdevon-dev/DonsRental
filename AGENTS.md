# Don's Rental — Car Booking System

## Architecture (3 packages)

```
agent/          ← ADK agent deployed to Vertex AI Agent Engine
  main.py       ← agent definition + 4 tools: get_vehicles, scan_license, check_availability, create_booking
  deploy.py     ← deploy interactive or via --auto with env vars
  requirements.txt  ← google-adk, google-cloud-aiplatform, sendgrid, etc.

backend/        ← FastAPI Cloud Run service
  main.py       ← proxies /api/chat to Agent Engine, serves frontend static files, /api/scan-license OCR
  requirements.txt  ← fastapi, uvicorn, httpx, google-api-python-client, sendgrid

frontend/       ← React 19 + Vite + TypeScript SPA
  package.json  ← scripts: dev, build, lint (oxlint), preview
  src/          ← 5-step booking flow components, api.ts service layer
```

## Local dev commands

**Agent**:
```bash
cd agent
pip install -r requirements.txt
export GEMINI_API_KEY=...
python -c "from main import *; print(get_vehicles())"
# or full local LLM test:
python ../test_agent_local.py
```

**Backend**:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to dist/
npm run lint         # uses oxlint (NOT eslint)
```

## Deploy flow

**Step 1 — Deploy ADK agent to Agent Engine:**
```bash
cd agent
python deploy.py          # interactive (prompts for keys)
# or with env vars:
python deploy.py --auto
```

**Step 2 — Deploy Cloud Run backend:**
```bash
export AGENT_ENGINE='projects/282546523551/locations/us-central1/reasoningEngines/4084942433152925696'
./deploy-cloudrun.sh
# or via Cloud Build (uses cloudbuild.yaml):
gcloud builds submit
```

- Dockerfile builds frontend (Node → static) then backend (Python → serving)
- `agent/` is excluded from the Docker image (`.dockerignore`)
- Backend Proxy endpoints: POST `/api/chat` → Agent Engine `streamQuery`
- Backend native endpoints: `/api/vehicles`, `/api/bookings`, `/api/check-availability`, `/api/scan-license`

## Key gotchas

- No test framework — just `test_local.py` (unit) and `test_agent_local.py` (live LLM). Run with `python test_*.py`.
- Frontend lint uses `oxlint`, not eslint. Run `npm run lint` from `frontend/`.
- In-memory booking store (`_bookings` list in `backend/main.py`) — resets on restart. Google Sheets is the persistent fallback.
- License OCR calls Gemini API directly (Gemini API key via env), not through Vertex AI.
- SendGrid optional; falls back to SMTP env vars, then logs-only.
- `.dockerignore` excludes `agent/` so the Cloud Run container cannot host the ADK agent itself.
- GCP project for cloudbuild defaults to `renal-car-booking` (from deploy-cloudrun.sh default), but cloudbuild.yaml uses substitutions.

## Required env vars

Backend/Agent Agent Engine: `GEMINI_API_KEY`, `SPREADSHEET_ID`, `GOOGLE_SHEETS_CREDENTIALS` (full JSON), `GCS_BUCKET`, `GCS_PHOTOS_PREFIX`, `SENDGRID_API_KEY` (optional), `OWNER_EMAIL` (optional)
Backend Cloud Run: `AGENT_ENGINE`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SHEETS_CREDENTIALS`, `GCS_BUCKET`, `GCS_PHOTOS_PREFIX`
Frontend: `VITE_API_BASE` (default `http://localhost:8000/api`)
