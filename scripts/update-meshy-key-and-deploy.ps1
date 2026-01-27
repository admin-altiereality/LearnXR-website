# Update Meshy API Key and Deploy Functions (PowerShell)
# This script updates the MESHY_API_KEY secret and deploys functions with the new key
# Optionally cleans up old secret versions

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [Parameter(Mandatory=$false)]
    [switch]$CleanupOldVersions
)

$ErrorActionPreference = "Stop"

$PROJECT_ID = "in3devoneuralai"
$SECRET_NAME = "MESHY_API_KEY"
$FUNCTION_NAME = "api"
$REGION = "us-central1"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Update Meshy API Key & Deploy Functions" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Validate API key format
if (-not $ApiKey.StartsWith("msy_")) {
    Write-Host "⚠️  Warning: API key doesn't start with 'msy_'. Are you sure this is correct?" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
}

Write-Host "Step 1: Updating Meshy API Key Secret..." -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host "Secret Name: $SECRET_NAME"
Write-Host "API Key: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))...$($ApiKey.Substring([Math]::Max(0, $ApiKey.Length - 4)))"
Write-Host ""

# Update the secret
$ApiKey | firebase functions:secrets:set $SECRET_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to update secret!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Secret updated successfully!" -ForegroundColor Green
Write-Host ""

# List secret versions (optional - requires gcloud)
Write-Host "Step 2: Checking Secret Versions..." -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""

try {
    $secretVersions = gcloud secrets versions list $SECRET_NAME --project=$PROJECT_ID --format="value(name)" 2>$null
    
    if ($secretVersions) {
        $versionCount = ($secretVersions | Measure-Object -Line).Lines
        Write-Host "Found $versionCount secret version(s)"
        Write-Host ""
        
        if ($CleanupOldVersions -and $versionCount -gt 1) {
            Write-Host "⚠️  Cleanup mode enabled. Old versions will be deleted." -ForegroundColor Yellow
            Write-Host ""
            
            $versionsArray = $secretVersions -split "`n" | Where-Object { $_.Trim() -ne "" }
            $latestVersion = $versionsArray[0]
            $oldVersions = $versionsArray[1..($versionsArray.Length - 1)]
            
            Write-Host "Latest version (will be kept): $latestVersion"
            Write-Host ""
            
            if ($oldVersions.Count -gt 0) {
                Write-Host "Old versions to delete:"
                foreach ($version in $oldVersions) {
                    Write-Host "  - $version"
                }
                Write-Host ""
                
                $response = Read-Host "Delete old secret versions? (y/N)"
                if ($response -eq "y" -or $response -eq "Y") {
                    Write-Host ""
                    Write-Host "Deleting old versions..."
                    foreach ($version in $oldVersions) {
                        $versionNum = $version.Split('/')[-1]
                        Write-Host "  Deleting version: $versionNum"
                        gcloud secrets versions destroy $versionNum --secret=$SECRET_NAME --project=$PROJECT_ID --quiet 2>$null
                    }
                    Write-Host "✅ Old versions cleanup complete!" -ForegroundColor Green
                } else {
                    Write-Host "Skipping cleanup of old versions."
                }
            } else {
                Write-Host "No old versions to delete."
            }
        } else {
            Write-Host "Old versions are kept (use -CleanupOldVersions to delete them)"
        }
    }
} catch {
    Write-Host "Could not list secret versions (this is okay if gcloud is not configured)"
}

Write-Host ""
Write-Host "Step 3: Building Functions..." -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""

Set-Location functions

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Build TypeScript
Write-Host "Building TypeScript..."
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Set-Location ..

Write-Host ""
Write-Host "Step 4: Deploying Functions..." -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""
Write-Host "This will deploy functions with the new Meshy API key."
Write-Host "The deployment may take a few minutes..."
Write-Host ""

firebase deploy --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Functions deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Functions deployed successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "Step 5: Verifying Deployment..." -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""

# Wait a moment for the function to be ready
Start-Sleep -Seconds 3

# Test the health endpoint
Write-Host "Testing health endpoint..."
try {
    $healthResponse = Invoke-RestMethod -Uri "https://us-central1-${PROJECT_ID}.cloudfunctions.net/api/health" -Method Get -ErrorAction SilentlyContinue
    
    if ($healthResponse.meshy -eq $true) {
        Write-Host "✅ Meshy API key is working!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Meshy API key may not be configured correctly." -ForegroundColor Yellow
        Write-Host "Response: $($healthResponse | ConvertTo-Json)"
    }
} catch {
    Write-Host "⚠️  Could not verify deployment (endpoint may not be ready yet)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================="
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "=========================================="
Write-Host ""
Write-Host "Function URL:"
Write-Host "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/api"
Write-Host ""
Write-Host "Health Check:"
Write-Host "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/api/health"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  1. Test Meshy API generation from your app"
Write-Host "  2. Check function logs if you encounter issues:"
Write-Host "     firebase functions:log --only api"
Write-Host ""
