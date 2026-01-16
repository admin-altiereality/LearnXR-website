# Firebase Services Verification Script
# Verifies connection to all Firebase services: Storage, Authentication, Firestore, and Functions

$ErrorActionPreference = "Continue"
$projectId = "learnxr-evoneuralai"
$firebaseConsoleUrl = "https://console.firebase.google.com/project/$projectId"

Write-Host ""
Write-Host "🔍 Firebase Services Verification" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

$servicesStatus = @{
    Firestore = @{ Status = "❌"; Details = "" }
    Storage = @{ Status = "❌"; Details = "" }
    Authentication = @{ Status = "❌"; Details = "" }
    Functions = @{ Status = "❌"; Details = "" }
}

# Test 1: Firestore Database
Write-Host "📋 Testing Firestore Database..." -ForegroundColor Yellow
try {
    $firestoreCheck = firebase firestore:databases:list 2>&1
    if ($firestoreCheck -match $projectId -or $firestoreCheck -match "default") {
        $servicesStatus.Firestore.Status = "✅"
        $servicesStatus.Firestore.Details = "Firestore is enabled and accessible"
        Write-Host "✅ Firestore: Enabled" -ForegroundColor Green
    } else {
        $servicesStatus.Firestore.Details = "Firestore may not be enabled"
        Write-Host "⚠️  Firestore: May not be enabled" -ForegroundColor Yellow
    }
} catch {
    $servicesStatus.Firestore.Details = "Error checking Firestore: $_"
    Write-Host "❌ Firestore: Error checking status" -ForegroundColor Red
}

# Check Firestore rules
if (Test-Path "firestore.rules") {
    Write-Host "   ✅ Firestore rules file exists" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Firestore rules file missing" -ForegroundColor Yellow
}

# Test 2: Storage
Write-Host ""
Write-Host "📋 Testing Storage..." -ForegroundColor Yellow
try {
    $storageCheck = firebase deploy --only storage:rules --dry-run 2>&1
    if ($storageCheck -match "Error: Could not find rules" -or $storageCheck -match "Storage not enabled") {
        $servicesStatus.Storage.Details = "Storage not enabled yet"
        Write-Host "⚠️  Storage: Not enabled" -ForegroundColor Yellow
        Write-Host "   Open: $firebaseConsoleUrl/storage" -ForegroundColor Gray
    } else {
        $servicesStatus.Storage.Status = "✅"
        $servicesStatus.Storage.Details = "Storage is enabled"
        Write-Host "✅ Storage: Enabled" -ForegroundColor Green
    }
} catch {
    $servicesStatus.Storage.Details = "Error checking Storage: $_"
    Write-Host "❌ Storage: Error checking status" -ForegroundColor Red
}

# Check Storage rules
if (Test-Path "storage.rules") {
    Write-Host "   ✅ Storage rules file exists" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Storage rules file missing" -ForegroundColor Yellow
}

# Test 3: Authentication
Write-Host ""
Write-Host "📋 Testing Authentication..." -ForegroundColor Yellow
try {
    # Check if auth is configured in client code
    $clientFirebaseConfig = "server\client\src\config\firebase.ts"
    if (Test-Path $clientFirebaseConfig) {
        $configContent = Get-Content $clientFirebaseConfig -Raw
        if ($configContent -match "getAuth" -and $configContent -match $projectId) {
            $servicesStatus.Authentication.Status = "✅"
            $servicesStatus.Authentication.Details = "Authentication configured in client code"
            Write-Host "✅ Authentication: Configured in code" -ForegroundColor Green
        } else {
            $servicesStatus.Authentication.Details = "Authentication not properly configured"
            Write-Host "⚠️  Authentication: Configuration incomplete" -ForegroundColor Yellow
        }
    } else {
        $servicesStatus.Authentication.Details = "Firebase config file not found"
        Write-Host "❌ Authentication: Config file missing" -ForegroundColor Red
    }
    Write-Host "   ⚠️  Note: Enable providers in console: $firebaseConsoleUrl/authentication" -ForegroundColor Gray
} catch {
    $servicesStatus.Authentication.Details = "Error checking Authentication: $_"
    Write-Host "❌ Authentication: Error checking status" -ForegroundColor Red
}

# Test 4: Functions
Write-Host ""
Write-Host "📋 Testing Functions..." -ForegroundColor Yellow
try {
    # Check if functions directory exists
    if (Test-Path "functions") {
        Write-Host "✅ Functions: Directory exists" -ForegroundColor Green
        $servicesStatus.Functions.Status = "✅"
        $servicesStatus.Functions.Details = "Functions directory found"
        
        # Check if functions are configured in firebase.json
        $firebaseJson = Get-Content "firebase.json" -Raw | ConvertFrom-Json
        if ($firebaseJson.functions) {
            Write-Host "   ✅ Functions configured in firebase.json" -ForegroundColor Gray
        }
        
        # Check if functions code exists
        if (Test-Path "functions\src\index.ts") {
            Write-Host "   ✅ Functions source code exists" -ForegroundColor Gray
        } else {
            Write-Host "   ⚠️  Functions source code missing" -ForegroundColor Yellow
        }
    } else {
        $servicesStatus.Functions.Details = "Functions directory not found"
        Write-Host "❌ Functions: Directory missing" -ForegroundColor Red
    }
} catch {
    $servicesStatus.Functions.Details = "Error checking Functions: $_"
    Write-Host "❌ Functions: Error checking status" -ForegroundColor Red
}

# Test 5: Service Account
Write-Host ""
Write-Host "📋 Checking Service Account..." -ForegroundColor Yellow
$serviceAccountFiles = @(Get-ChildItem -Path "." -Filter "$projectId-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue)
if ($serviceAccountFiles.Count -gt 0) {
    Write-Host "✅ Service account file found: $($serviceAccountFiles[0].Name)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service account file not found" -ForegroundColor Yellow
    Write-Host "   Download from: $firebaseConsoleUrl/settings/serviceaccounts/adminsdk" -ForegroundColor Gray
}

# Test 6: Environment Files
Write-Host ""
Write-Host "📋 Checking Environment Files..." -ForegroundColor Yellow
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

# Test 7: Run Node.js connection test
Write-Host ""
Write-Host "📋 Running Node.js Connection Test..." -ForegroundColor Yellow
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
Write-Host "📊 Services Status Summary" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

foreach ($service in $servicesStatus.GetEnumerator()) {
    $status = $service.Value.Status
    $details = $service.Value.Details
    Write-Host "$status $($service.Key): $details" -ForegroundColor $(if ($status -eq "✅") { "Green" } else { "Yellow" })
}

Write-Host ""
Write-Host "🔗 Quick Links:" -ForegroundColor Cyan
Write-Host "   Firestore: $firebaseConsoleUrl/firestore" -ForegroundColor White
Write-Host "   Storage: $firebaseConsoleUrl/storage" -ForegroundColor White
Write-Host "   Authentication: $firebaseConsoleUrl/authentication" -ForegroundColor White
Write-Host "   Functions: $firebaseConsoleUrl/functions" -ForegroundColor White
Write-Host "   Service Accounts: $firebaseConsoleUrl/settings/serviceaccounts/adminsdk" -ForegroundColor White

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Enable any missing services in Firebase Console" -ForegroundColor White
Write-Host "   2. Deploy rules: firebase deploy --only firestore:rules,storage:rules" -ForegroundColor White
Write-Host "   3. Deploy functions: firebase deploy --only functions" -ForegroundColor White
Write-Host "   4. Test again: .\scripts\verify-firebase-services.ps1" -ForegroundColor White
Write-Host ""

