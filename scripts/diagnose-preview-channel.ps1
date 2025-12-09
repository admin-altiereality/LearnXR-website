# Diagnose Preview Channel Skybox Generation Issues
Write-Host "`n=== Preview Channel Diagnostic ===" -ForegroundColor Cyan

$previewUrl = "https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app"
$apiUrl = "https://us-central1-in3devoneuralai.cloudfunctions.net/api"

Write-Host "`n1. Testing API Endpoint..." -ForegroundColor Yellow
Write-Host "   API URL: $apiUrl" -ForegroundColor Gray

try {
    $envCheck = Invoke-WebRequest -Uri "$apiUrl/env-check" -UseBasicParsing
    $envData = $envCheck.Content | ConvertFrom-Json
    Write-Host "   ✅ API is accessible" -ForegroundColor Green
    Write-Host "   BlockadeLabs: $($envData.blockadelabs)" -ForegroundColor $(if ($envData.blockadelabs) { "Green" } else { "Red" })
    Write-Host "   Razorpay: $($envData.razorpay)" -ForegroundColor $(if ($envData.razorpay) { "Green" } else { "Yellow" })
} catch {
    Write-Host "   ❌ API is not accessible: $_" -ForegroundColor Red
    Write-Host "   This could be a CORS or network issue." -ForegroundColor Yellow
}

Write-Host "`n2. Testing Skybox Styles Endpoint..." -ForegroundColor Yellow
try {
    $stylesCheck = Invoke-WebRequest -Uri "$apiUrl/skybox/styles" -UseBasicParsing
    $stylesData = $stylesCheck.Content | ConvertFrom-Json
    Write-Host "   ✅ Styles endpoint working" -ForegroundColor Green
    Write-Host "   Found $($stylesData.data.styles.Count) styles" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Styles endpoint failed: $_" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}

Write-Host "`n3. Checking Preview Channel..." -ForegroundColor Yellow
Write-Host "   Preview URL: $previewUrl" -ForegroundColor Gray
try {
    $previewCheck = Invoke-WebRequest -Uri "$previewUrl/main" -UseBasicParsing
    Write-Host "   ✅ Preview channel is accessible" -ForegroundColor Green
    Write-Host "   Status: $($previewCheck.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Preview channel check failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Diagnostic Summary ===" -ForegroundColor Cyan
Write-Host "`nCommon Issues:" -ForegroundColor White
Write-Host "1. Client not rebuilt - Run: cd server/client; npm run build:firebase" -ForegroundColor Gray
Write-Host "2. Preview channel not redeployed - Run: .\deploy-preview-channel.ps1" -ForegroundColor Gray
Write-Host "3. Browser cache - Clear browser storage and hard refresh (Ctrl+F5)" -ForegroundColor Gray
Write-Host "4. CORS issues - Check browser console for CORS errors" -ForegroundColor Gray
Write-Host "5. API URL mismatch - Verify client is using correct API endpoint" -ForegroundColor Gray

Write-Host "`nNext Steps:" -ForegroundColor White
Write-Host "1. Open browser console (F12) on preview channel" -ForegroundColor Gray
Write-Host "2. Try generating a skybox" -ForegroundColor Gray
Write-Host "3. Check console for errors" -ForegroundColor Gray
Write-Host "4. Check Network tab for failed requests" -ForegroundColor Gray
Write-Host ""

