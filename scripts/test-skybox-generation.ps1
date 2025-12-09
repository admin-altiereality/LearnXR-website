# Test Skybox Generation Endpoint
Write-Host "`n=== Testing Skybox Generation ===" -ForegroundColor Cyan

$apiUrl = "https://us-central1-in3devoneuralai.cloudfunctions.net/api"

Write-Host "`n1. Testing /skybox/generate endpoint..." -ForegroundColor Yellow
Write-Host "   Note: This requires authentication, so it may fail with 401" -ForegroundColor Gray
Write-Host "   But we can check if the endpoint is accessible" -ForegroundColor Gray

try {
    $testPayload = @{
        prompt = "test skybox"
        style_id = 1
        negative_prompt = ""
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$apiUrl/skybox/generate" `
        -Method POST `
        -Body $testPayload `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✅ Generation endpoint is accessible" -ForegroundColor Green
    $responseData = $response.Content | ConvertFrom-Json
    Write-Host "   Response: $($responseData | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 401) { "Yellow" } else { "Red" })
    
    if ($statusCode -eq 401) {
        Write-Host "   ⚠️  Authentication required (expected)" -ForegroundColor Yellow
        Write-Host "   This is normal - the endpoint requires Firebase Auth" -ForegroundColor Gray
    } elseif ($statusCode -eq 400) {
        Write-Host "   ❌ Bad request - check payload" -ForegroundColor Red
    } elseif ($statusCode -eq 503) {
        Write-Host "   ❌ API key not configured!" -ForegroundColor Red
    } else {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host "`n2. Checking if generation is being created..." -ForegroundColor Yellow
Write-Host "   The error suggests generation is not being created." -ForegroundColor Gray
Write-Host "   Possible causes:" -ForegroundColor White
Write-Host "   - API key issue (403/401)" -ForegroundColor Gray
Write-Host "   - Quota exceeded (403)" -ForegroundColor Gray
Write-Host "   - Invalid request (400)" -ForegroundColor Gray
Write-Host "   - Network/API error (500)" -ForegroundColor Gray

Write-Host "`n3. Check browser console for:" -ForegroundColor Yellow
Write-Host "   - Initial generation request response" -ForegroundColor Gray
Write-Host "   - Any error messages from /skybox/generate" -ForegroundColor Gray
Write-Host "   - Generation ID received (if any)" -ForegroundColor Gray

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Open browser console (F12) on preview channel" -ForegroundColor White
Write-Host "2. Try generating a skybox" -ForegroundColor White
Write-Host "3. Check Network tab for /skybox/generate request" -ForegroundColor White
Write-Host "4. Look at the response - what error code/message?" -ForegroundColor White
Write-Host ""

