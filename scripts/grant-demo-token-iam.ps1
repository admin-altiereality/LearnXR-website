# Grant the default Compute/Cloud Run service account the "Service Account Token Creator"
# role on itself so that createCustomToken() works in the API (demo login).
# See docs/DEMO_TOKEN_IAM_FIX.md

param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "learnxr-evoneuralai"
)

$ErrorActionPreference = "Stop"
Write-Host "`n=== Grant Demo Token IAM (signBlob) ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor Gray

# Resolve project number
Write-Host "Resolving project number..." -ForegroundColor Gray
$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)" 2>$null
if (-not $projectNumber) {
    Write-Host "Failed to get project number. Is gcloud installed and logged in? Try: gcloud auth login" -ForegroundColor Red
    exit 1
}
Write-Host "Project number: $projectNumber" -ForegroundColor Gray

$computeSa = "${projectNumber}-compute@developer.gserviceaccount.com"
Write-Host "Default compute SA: $computeSa" -ForegroundColor Gray

Write-Host "`nGranting roles/iam.serviceAccountTokenCreator to $computeSa on itself..." -ForegroundColor Green
gcloud iam service-accounts add-iam-policy-binding $computeSa `
    --member="serviceAccount:$computeSa" `
    --role="roles/iam.serviceAccountTokenCreator" `
    --project=$ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nIAM update failed." -ForegroundColor Red
    exit 1
}

Write-Host "`nDone. Demo login (createCustomToken) should work now. Try again on the preview channel." -ForegroundColor Green
Write-Host ""
