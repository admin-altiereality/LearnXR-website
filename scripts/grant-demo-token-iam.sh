#!/usr/bin/env bash
# Grant the default Compute/Cloud Run service account the "Service Account Token Creator"
# role on itself so that createCustomToken() works in the API (demo login).
# See docs/DEMO_TOKEN_IAM_FIX.md

set -e
PROJECT_ID="${1:-learnxr-evoneuralai}"

echo ""
echo "=== Grant Demo Token IAM (signBlob) ==="
echo "Project: $PROJECT_ID"

echo "Resolving project number..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null) || true
if [ -z "$PROJECT_NUMBER" ]; then
  echo "Failed to get project number. Is gcloud installed and logged in? Try: gcloud auth login"
  exit 1
fi
echo "Project number: $PROJECT_NUMBER"

COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Default compute SA: $COMPUTE_SA"

echo ""
echo "Granting roles/iam.serviceAccountTokenCreator to $COMPUTE_SA on itself..."
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="$PROJECT_ID"

echo ""
echo "Done. Demo login (createCustomToken) should work now. Try again on the preview channel."
echo ""
