# Service Account Download Helper Script
# Opens the service account page and provides instructions

$projectId = "learnxr-evoneuralai"
$serviceAccountUrl = "https://console.firebase.google.com/project/$projectId/settings/serviceaccounts/adminsdk"

Write-Host ""
Write-Host "🔑 Service Account Setup Helper" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

Write-Host "Opening Service Accounts page..." -ForegroundColor Yellow
Start-Process $serviceAccountUrl

Write-Host ""
Write-Host "📋 Follow these steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. In the opened browser tab:" -ForegroundColor White
Write-Host "   - Make sure you're on the 'Service accounts' tab" -ForegroundColor Gray
Write-Host "   - Click 'Generate new private key' button" -ForegroundColor Gray
Write-Host "   - Click 'Generate key' in the confirmation dialog" -ForegroundColor Gray
Write-Host ""
Write-Host "2. The JSON file will download automatically" -ForegroundColor White
Write-Host ""
Write-Host "3. Move the downloaded file to:" -ForegroundColor White
Write-Host "   D:\learnxr-evoneuralai\" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Rename it to start with:" -ForegroundColor White
Write-Host "   $projectId-firebase-adminsdk-" -ForegroundColor Yellow
Write-Host "   (Keep the rest of the filename as-is)" -ForegroundColor Gray
Write-Host ""
Write-Host "5. The system will automatically detect and use it!" -ForegroundColor Green
Write-Host ""

# Check if file already exists
$existingFiles = Get-ChildItem -Path "." -Filter "$projectId-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue
if ($existingFiles) {
    Write-Host "✅ Found existing service account: $($existingFiles[0].Name)" -ForegroundColor Green
    Write-Host "   You can skip the download if this is correct." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key when you've placed the file..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Verify file
$files = Get-ChildItem -Path "." -Filter "$projectId-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue
if ($files) {
    Write-Host ""
    Write-Host "✅ Service account file found: $($files[0].Name)" -ForegroundColor Green
    Write-Host "   Setup complete!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Service account file not found in project root" -ForegroundColor Yellow
    Write-Host "   Make sure the file is in: D:\learnxr-evoneuralai\" -ForegroundColor Yellow
}

