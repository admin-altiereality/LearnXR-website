# Script to deploy functions after BLOCKADE_API_KEY is set
Write-Host "`n=== Deploying Firebase Functions ===" -ForegroundColor Cyan
Write-Host "Make sure you've completed:" -ForegroundColor Yellow
Write-Host "1. Created BLOCKADE_API_KEY secret in Secret Manager" -ForegroundColor White
Write-Host "2. Granted Secret Manager Secret Accessor role to service account`n" -ForegroundColor White

$confirm = Read-Host "Have you completed both steps? (y/n)"
if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host "`nDeploying functions..." -ForegroundColor Green
    firebase deploy --only functions
} else {
    Write-Host "`nPlease complete the setup steps first." -ForegroundColor Red
    Write-Host "See QUICK_FIX_BLOCKADE_API_KEY.md for instructions.`n" -ForegroundColor Yellow
}

