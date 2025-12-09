# PowerShell script to help set BLOCKADE_API_KEY secret
# This script will open the Google Cloud Console and provide instructions

$apiKey = "hcmELHEKZuGMVCjrHgojXQDoKoXJJzcKpVaGEonoaNktA8WmIqTGlzsTZ9gh"
$projectId = "in3devoneuralai"

Write-Host "`n=== Setting up BLOCKADE_API_KEY ===" -ForegroundColor Cyan
Write-Host "`nAPI Key found in env.template" -ForegroundColor Green
Write-Host "`nOpening Google Cloud Console Secret Manager..." -ForegroundColor Yellow

# Open Secret Manager in browser
$secretManagerUrl = "https://console.cloud.google.com/security/secret-manager?project=$projectId"
Start-Process $secretManagerUrl

Write-Host "`n=== INSTRUCTIONS ===" -ForegroundColor Cyan
Write-Host "1. In the browser that just opened, click 'CREATE SECRET'" -ForegroundColor White
Write-Host "2. Name: BLOCKADE_API_KEY" -ForegroundColor White
Write-Host "3. Secret value: (API key is copied below)" -ForegroundColor White
Write-Host "`nYour API Key:" -ForegroundColor Green
Write-Host $apiKey -ForegroundColor Yellow -BackgroundColor Black
Write-Host "`n4. Click 'CREATE SECRET'" -ForegroundColor White
Write-Host "`n5. After creating, grant access to service account:" -ForegroundColor White
Write-Host "   - Go to IAM: https://console.cloud.google.com/iam-admin/iam?project=$projectId" -ForegroundColor Cyan
Write-Host "   - Find: in3devoneuralai@appspot.gserviceaccount.com" -ForegroundColor White
Write-Host "   - Add role: Secret Manager Secret Accessor" -ForegroundColor White
Write-Host "`n6. Then run: firebase deploy --only functions" -ForegroundColor White
Write-Host "`nPress any key to copy API key to clipboard..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Copy to clipboard
$apiKey | Set-Clipboard
Write-Host "`n✅ API Key copied to clipboard!" -ForegroundColor Green
Write-Host "You can now paste it in the Secret Manager form.`n" -ForegroundColor Green

