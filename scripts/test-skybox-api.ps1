# Test Skybox API Configuration
Write-Host "`n=== Testing Skybox API Configuration ===" -ForegroundColor Cyan

Write-Host "`n1. Testing /env-check endpoint..." -ForegroundColor Yellow
try {
    $envCheck = Invoke-WebRequest -Uri "https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check" -UseBasicParsing
    $envData = $envCheck.Content | ConvertFrom-Json
    Write-Host "✅ Environment check successful" -ForegroundColor Green
    Write-Host "   BlockadeLabs configured: $($envData.blockadelabs)" -ForegroundColor $(if ($envData.blockadelabs) { "Green" } else { "Red" })
    Write-Host "   Razorpay configured: $($envData.razorpay)" -ForegroundColor $(if ($envData.razorpay) { "Green" } else { "Yellow" })
    
    if (-not $envData.blockadelabs) {
        Write-Host "`n❌ BLOCKADE_API_KEY is not configured!" -ForegroundColor Red
        Write-Host "   The secret may be disabled or not accessible." -ForegroundColor Yellow
        Write-Host "   See ENABLE_SECRET.md for instructions." -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "❌ Failed to check environment: $_" -ForegroundColor Red
    Write-Host "   Functions may not be deployed or API is down." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n2. Testing /skybox/styles endpoint..." -ForegroundColor Yellow
try {
    $stylesCheck = Invoke-WebRequest -Uri "https://us-central1-in3devoneuralai.cloudfunctions.net/api/skybox/styles" -UseBasicParsing
    $stylesData = $stylesCheck.Content | ConvertFrom-Json
    Write-Host "✅ Skybox styles endpoint working" -ForegroundColor Green
    Write-Host "   Found $($stylesData.data.styles.Count) styles" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to get skybox styles: $_" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 503) {
        Write-Host "   API key is not configured or secret is disabled." -ForegroundColor Yellow
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "If BlockadeLabs is not configured:" -ForegroundColor White
Write-Host "1. Enable BLOCKADE_API_KEY secret in Google Cloud Console" -ForegroundColor Gray
Write-Host "2. Redeploy functions: firebase deploy --only functions" -ForegroundColor Gray
Write-Host "`nSee ENABLE_SECRET.md for detailed instructions." -ForegroundColor Cyan
Write-Host ""

