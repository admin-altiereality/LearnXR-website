# Quick script to help with final setup
Write-Host "`n=== Final Setup Steps ===" -ForegroundColor Cyan
Write-Host "`nSince you're now the owner, complete these steps:" -ForegroundColor Yellow

Write-Host "`n1. Grant Service Account User Role to Yourself:" -ForegroundColor White
Write-Host "   - Visit: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai" -ForegroundColor Cyan
Write-Host "   - Find: manavkhandelwal72@gmail.com" -ForegroundColor Gray
Write-Host "   - Edit → Add role: 'Service Account User'" -ForegroundColor Gray
Write-Host "   - Save" -ForegroundColor Gray

Write-Host "`n2. Verify Service Account Has Secret Access:" -ForegroundColor White
Write-Host "   - Visit: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai" -ForegroundColor Cyan
Write-Host "   - Click on BLOCKADE_API_KEY" -ForegroundColor Gray
Write-Host "   - Go to Permissions tab" -ForegroundColor Gray
Write-Host "   - Verify: in3devoneuralai@appspot.gserviceaccount.com has 'Secret Manager Secret Accessor'" -ForegroundColor Gray
Write-Host "   - If not, grant it access" -ForegroundColor Gray

Write-Host "`n3. After completing above, press any key to deploy..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`nDeploying functions (shared, needed for API)..." -ForegroundColor Green
firebase deploy --only functions

Write-Host "`nNote: For testing, use deploy-preview-channel.ps1 to deploy hosting to preview channel only" -ForegroundColor Cyan
Write-Host "   (Functions must be deployed to production as they are shared)" -ForegroundColor Gray

