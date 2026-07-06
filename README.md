# Don's Rental — Car Booking Agent

A self-service car rental booking system powered by **Vertex AI Agent Engine (ADK)**.

## Architecture

```
frontend/              ← Booking SPA (HTML/JS/CSS)
  → calls →
agent/main.py          ← ADK agent with tools:
                          • get_vehicles()   — reads Google Sheets
                          • scan_license()   — Gemini OCR
                          • create_booking() — writes Sheets + SendGrid
  → deploys to →
Vertex AI Agent Engine  ← managed runtime (uses your Vertex AI credits)
```

## What it does

- Customers book vehicles through a 5-step web form
- **Take a photo** of their driver's license → fields auto-fill via Gemini
- Booking saved to **Google Sheets**
- **Invoice emailed** automatically via SendGrid
- **You get notified** when a booking comes in

## Deploy to Agent Engine

```bash
cd agent
pip install -r requirements.txt
python deploy.py
```

The deploy script prompts you for your API keys and deploys to `onlineeverywhere` project.

## Quick start (local)

```bash
cd agent
export GEMINI_API_KEY=...
python -c "from main import *; print(get_vehicles())"
```

## Files

| Path | Purpose |
|------|---------|
| `agent/main.py` | ADK agent definition + all tools |
| `agent/deploy.py` | One-command deployment to Agent Engine |
| `agent/requirements.txt` | Python dependencies |
| `frontend/index.html` | Booking SPA |
| `frontend/app.js` | Frontend logic (camera, forms, agent calls) |
| `frontend/style.css` | Responsive styling |

