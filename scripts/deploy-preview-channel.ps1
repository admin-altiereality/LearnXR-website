# Deploy to Preview Channel Only (for testing)
# This script deploys functions and hosting to a preview channel, NOT production

param(
    [Parameter(Mandatory=$false)]
    [string]$ChannelName = "test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)

Write-Host "`n=== Deploying to Preview Channel ===" -ForegroundColor Cyan
Write-Host "Channel Name: $ChannelName" -ForegroundColor Yellow
Write-Host "`nThis will:" -ForegroundColor White
Write-Host "  1. Deploy Firebase Functions (shared, needed for API)" -ForegroundColor Gray
Write-Host "  2. Deploy Hosting to preview channel ONLY (not production)" -ForegroundColor Gray
Write-Host "`nPreview URL will be: https://in3devoneuralai--$ChannelName.web.app" -ForegroundColor Cyan

Write-Host "`nPress any key to continue or Ctrl+C to cancel..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`nStep 1: Deploying Functions..." -ForegroundColor Green
firebase deploy --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Functions deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 2: Building client..." -ForegroundColor Green
Set-Location server/client
npm run build:firebase

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Client build failed!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Set-Location ../..

Write-Host "`nStep 3: Deploying Hosting to Preview Channel..." -ForegroundColor Green
firebase hosting:channel:deploy $ChannelName

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Preview channel deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nPreview Channel URL:" -ForegroundColor Cyan
Write-Host "https://in3devoneuralai--$ChannelName.web.app" -ForegroundColor Yellow
Write-Host "`nNote: Functions are deployed to production (shared), but hosting is only on preview channel." -ForegroundColor Gray
Write-Host ""

