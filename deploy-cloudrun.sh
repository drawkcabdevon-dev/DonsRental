#!/usr/bin/env bash
set -euo pipefail

# ─── Don's Rental — Deploy to Cloud Run ─────────────────────────────
# Usage:
#   export AGENT_ENGINE="projects/450188951493/locations/us-central1/reasoningEngines/8385401789733666816"
#   ./deploy-cloudrun.sh
#
# Optional env vars:
#   PROJECT     (default: renal-car-booking)
#   LOCATION    (default: us-central1)
#   SERVICE_NAME (default: dons-rental)
#   REGION      (default: us-central1)
# ─────────────────────────────────────────────────────────────────────

PROJECT="${PROJECT:-renal-car-booking}"
LOCATION="${LOCATION:-us-central1}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-dons-rental}"

AGENT_ENGINE="${AGENT_ENGINE:-}"
if [ -z "$AGENT_ENGINE" ]; then
  echo "ERROR: AGENT_ENGINE env var is required"
  echo "  export AGENT_ENGINE='projects/.../locations/us-central1/reasoningEngines/...'"
  exit 1
fi

IMAGE="gcr.io/${PROJECT}/${SERVICE_NAME}"

echo "================================================"
echo " Don's Rental — Cloud Run Deploy"
echo " Project:    ${PROJECT}"
echo " Region:     ${REGION}"
echo " Service:    ${SERVICE_NAME}"
echo " Agent Eng:  ${AGENT_ENGINE}"
echo " Image:      ${IMAGE}"
echo "================================================"

echo ""
echo "1. Building container..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT}" --quiet

echo ""
echo "2. Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars "AGENT_ENGINE=${AGENT_ENGINE},GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${LOCATION}" \
  --quiet

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --format 'value(status.url)')

echo ""
echo "================================================"
echo "✅  DEPLOYED!"
echo "   URL: ${URL}"
echo "================================================"
