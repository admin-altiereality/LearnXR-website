# Quick Firebase Setup Script
# Opens all necessary Firebase Console pages in your browser

$projectId = "learnxr-evoneuralai"
$baseUrl = "https://console.firebase.google.com/project/$projectId"

Write-Host "🚀 Opening Firebase Console pages..." -ForegroundColor Cyan
Write-Host ""

# Open all necessary pages
$pages = @(
    @{Name="Project Overview"; Url="$baseUrl/overview"},
    @{Name="Authentication"; Url="$baseUrl/authentication"},
    @{Name="Firestore Database"; Url="$baseUrl/firestore"},
    @{Name="Storage"; Url="$baseUrl/storage"},
    @{Name="Service Accounts"; Url="$baseUrl/settings/serviceaccounts/adminsdk"}
)

foreach ($page in $pages) {
    Write-Host "Opening: $($page.Name)..." -ForegroundColor Yellow
    Start-Process $page.Url
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "✅ All pages opened in your browser!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Enable Authentication (enable Email/Password and Google)" -ForegroundColor White
Write-Host "  2. Create Firestore database (choose Production mode)" -ForegroundColor White
Write-Host "  3. Enable Storage (choose Production mode)" -ForegroundColor White
Write-Host "  4. Download service account key (Generate new private key)" -ForegroundColor White
Write-Host "  5. Place service account JSON in project root" -ForegroundColor White
Write-Host ""
Write-Host "Then run: node scripts/test-firebase-connection.js" -ForegroundColor Yellow

