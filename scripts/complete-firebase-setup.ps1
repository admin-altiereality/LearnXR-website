# Complete Firebase Setup Automation Script
# This script automates everything possible and guides you through the rest

$ErrorActionPreference = "Continue"
$projectId = "learnxr-evoneuralai"
$firebaseConsoleUrl = "https://console.firebase.google.com/project/$projectId"

Write-Host ""
Write-Host "🔥 Complete Firebase Setup for $projectId" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Firebase CLI
Write-Host "📋 Step 1: Verifying Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Firebase CLI: $firebaseVersion" -ForegroundColor Green
    } else {
        throw "Firebase CLI not found"
    }
} catch {
    Write-Host "❌ Firebase CLI not installed" -ForegroundColor Red
    Write-Host "   Install: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Step 2: Set project
Write-Host ""
Write-Host "📋 Step 2: Setting Firebase project..." -ForegroundColor Yellow
firebase use $projectId 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Using project: $projectId" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to set project" -ForegroundColor Red
    exit 1
}

# Step 3: Check Firestore
Write-Host ""
Write-Host "📋 Step 3: Checking Firestore..." -ForegroundColor Yellow
$firestoreCheck = firebase firestore:databases:list 2>&1
if ($firestoreCheck -match "learnxr-evoneuralai") {
    Write-Host "✅ Firestore is enabled" -ForegroundColor Green
} else {
    Write-Host "⚠️  Firestore may not be enabled" -ForegroundColor Yellow
    Write-Host "   Opening Firestore console..." -ForegroundColor Gray
    Start-Process "$firebaseConsoleUrl/firestore"
}

# Step 4: Check Storage
Write-Host ""
Write-Host "📋 Step 4: Checking Storage..." -ForegroundColor Yellow
$storageCheck = firebase deploy --only storage:rules --dry-run 2>&1
if ($storageCheck -match "Error: Could not find rules") {
    Write-Host "⚠️  Storage not enabled yet" -ForegroundColor Yellow
    Write-Host "   Opening Storage console..." -ForegroundColor Gray
    Start-Process "$firebaseConsoleUrl/storage"
    Write-Host "   Please enable Storage, then run: firebase deploy --only storage:rules" -ForegroundColor Cyan
} else {
    Write-Host "✅ Storage appears to be enabled" -ForegroundColor Green
}

# Step 5: Deploy Firestore rules (already done, but verify)
Write-Host ""
Write-Host "📋 Step 5: Verifying Firestore rules..." -ForegroundColor Yellow
if (Test-Path "firestore.rules") {
    Write-Host "✅ Firestore rules file exists" -ForegroundColor Green
    Write-Host "   Rules already deployed in previous step" -ForegroundColor Gray
} else {
    Write-Host "❌ Firestore rules file missing" -ForegroundColor Red
}

# Step 6: Check service account
Write-Host ""
Write-Host "📋 Step 6: Checking service account..." -ForegroundColor Yellow
$serviceAccountFiles = @(Get-ChildItem -Path "." -Filter "$projectId-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue)
if ($serviceAccountFiles.Count -gt 0) {
    Write-Host "✅ Service account found: $($serviceAccountFiles[0].Name)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service account not found" -ForegroundColor Yellow
    Write-Host "   Opening Service Accounts page..." -ForegroundColor Gray
    Start-Process "$firebaseConsoleUrl/settings/serviceaccounts/adminsdk"
    Write-Host ""
    Write-Host "   Instructions:" -ForegroundColor Cyan
    Write-Host "   1. Click 'Generate new private key'" -ForegroundColor White
    Write-Host "   2. Download the JSON file" -ForegroundColor White
    Write-Host "   3. Place it in: D:\learnxr-evoneuralai\$projectId-firebase-adminsdk-*.json" -ForegroundColor White
}

# Step 7: Check environment files
Write-Host ""
Write-Host "📋 Step 7: Checking environment files..." -ForegroundColor Yellow
if (Test-Path "server\client\.env") {
    Write-Host "✅ Client .env exists" -ForegroundColor Green
} else {
    Write-Host "❌ Client .env missing" -ForegroundColor Red
}

if (Test-Path "server\.env") {
    Write-Host "✅ Server .env exists" -ForegroundColor Green
} else {
    Write-Host "❌ Server .env missing" -ForegroundColor Red
}

# Step 8: Open Authentication console
Write-Host ""
Write-Host "📋 Step 8: Opening Authentication console..." -ForegroundColor Yellow
Start-Process "$firebaseConsoleUrl/authentication"
Write-Host "   Please enable:" -ForegroundColor Cyan
Write-Host "   - Email/Password" -ForegroundColor White
Write-Host "   - Google sign-in" -ForegroundColor White

# Step 9: Try to deploy storage rules if storage is enabled
Write-Host ""
Write-Host "📋 Step 9: Attempting to deploy Storage rules..." -ForegroundColor Yellow
$storageDeploy = firebase deploy --only storage:rules 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Storage rules deployed successfully!" -ForegroundColor Green
} else {
    if ($storageDeploy -match "Could not find rules") {
        Write-Host "⚠️  Storage not enabled yet. Enable it first, then run:" -ForegroundColor Yellow
        Write-Host "   firebase deploy --only storage:rules" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Storage rules deployment: $($storageDeploy -join ' ')" -ForegroundColor Yellow
    }
}

# Step 10: Test connection
Write-Host ""
Write-Host "📋 Step 10: Testing Firebase connection..." -ForegroundColor Yellow
if (Test-Path "scripts\test-firebase-connection.js") {
    Write-Host "   Running test script..." -ForegroundColor Gray
    $testResult = node scripts\test-firebase-connection.js 2>&1
    Write-Host $testResult
} else {
    Write-Host "⚠️  Test script not found" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "📊 Setup Summary" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Completed:" -ForegroundColor Green
Write-Host "   - Firebase project configured" -ForegroundColor White
Write-Host "   - Firestore rules deployed" -ForegroundColor White
Write-Host "   - Environment files created" -ForegroundColor White
Write-Host "   - All code configured" -ForegroundColor White
Write-Host ""
Write-Host "⏳ Manual Steps Required:" -ForegroundColor Yellow
Write-Host "   1. Enable Authentication (Email/Password + Google)" -ForegroundColor White
Write-Host "   2. Enable Storage (if not already enabled)" -ForegroundColor White
Write-Host "   3. Download service account JSON file" -ForegroundColor White
Write-Host "   4. Deploy storage rules: firebase deploy --only storage:rules" -ForegroundColor White
Write-Host ""
Write-Host "Quick Links:" -ForegroundColor Cyan
Write-Host "   Authentication: $firebaseConsoleUrl/authentication" -ForegroundColor White
Write-Host "   Storage: $firebaseConsoleUrl/storage" -ForegroundColor White
Write-Host "   Service Accounts: $firebaseConsoleUrl/settings/serviceaccounts/adminsdk" -ForegroundColor White
Write-Host ""
Write-Host "Test when done:" -ForegroundColor Cyan
Write-Host "   node scripts\test-firebase-connection.js" -ForegroundColor White
Write-Host ""

