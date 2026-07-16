#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-renal-car-booking}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-dons-rental}"
SPREADSHEET_ID="${SPREADSHEET_ID:-1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0}"

AGENT_ENGINE="${AGENT_ENGINE:-}"
if [ -z "$AGENT_ENGINE" ]; then
  echo "ERROR: AGENT_ENGINE env var is required"
  echo "  export AGENT_ENGINE='projects/.../locations/us-central1/reasoningEngines/...'"
  exit 1
fi

echo "================================================"
echo " Don's Rental — Cloud Run Deploy"
echo " Project:    ${PROJECT}"
echo " Region:     ${REGION}"
echo " Service:    ${SERVICE_NAME}"
echo " Agent Eng:  ${AGENT_ENGINE}"
echo "================================================"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars "AGENT_ENGINE=${AGENT_ENGINE},GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${REGION},SPREADSHEET_ID=${SPREADSHEET_ID}" \
  --quiet

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --format 'value(status.url)')

echo ""
echo "================================================"
echo "✅  DEPLOYED!"
echo "   URL: ${URL}"
echo "================================================"
