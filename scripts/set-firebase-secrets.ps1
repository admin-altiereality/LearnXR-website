# PowerShell script to set Firebase Functions secrets
# Usage: .\scripts\set-firebase-secrets.ps1

Write-Host ""
Write-Host "=== Setting Firebase Functions Secrets ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You will be prompted to enter each secret value." -ForegroundColor Yellow
Write-Host "Values are hidden as you type for security." -ForegroundColor Yellow
Write-Host ""

# Function to set a secret
function Set-FirebaseSecret {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "Setting: $SecretName" -ForegroundColor White
    if ($Description) {
        Write-Host "Description: $Description" -ForegroundColor Gray
    }
    Write-Host ""
    
    $secureValue = Read-Host "Enter the value (input will be hidden)" -AsSecureString
    $secretValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    )
    
    if ([string]::IsNullOrWhiteSpace($secretValue)) {
        Write-Host "⚠️  Skipping $SecretName (empty value provided)" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "Setting secret..." -ForegroundColor Gray
    $secretValue | firebase functions:secrets:set $SecretName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $SecretName set successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Failed to set $SecretName" -ForegroundColor Red
        return $false
    }
}

# Set required secrets (Razorpay removed)
$secretsSet = @()

$secretsSet += Set-FirebaseSecret "BLOCKADE_API_KEY" "BlockadeLabs API key for skybox generation (get from https://www.blockadelabs.com/)"
$secretsSet += Set-FirebaseSecret "OPENAI_API_KEY" "OpenAI API key for AI features (get from https://platform.openai.com/api-keys)"
$secretsSet += Set-FirebaseSecret "OPENAI_AVATAR_API_KEY" "OpenAI API key for avatar assistant (optional, will fallback to OPENAI_API_KEY if not set)"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Secret Setup Complete ===" -ForegroundColor Cyan
Write-Host ""

$successCount = ($secretsSet | Where-Object { $_ -eq $true }).Count
Write-Host "Successfully set $successCount out of $($secretsSet.Count) secrets" -ForegroundColor $(if ($successCount -eq $secretsSet.Count) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "To deploy functions, run:" -ForegroundColor Yellow
Write-Host "  firebase deploy --only functions" -ForegroundColor White
Write-Host ""

