# Firebase Complete Setup Script
# This script helps you complete the Firebase setup for learnxr-evoneuralai

Write-Host "🔥 Firebase Complete Setup for learnxr-evoneuralai" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$projectId = "learnxr-evoneuralai"
$firebaseConsoleUrl = "https://console.firebase.google.com/project/$projectId"

# Step 1: Check if Firebase CLI is installed
Write-Host "📋 Step 1: Checking Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Installing..." -ForegroundColor Red
    Write-Host "   Run: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "   Then run: firebase login" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check if logged in
Write-Host ""
Write-Host "📋 Step 2: Checking Firebase login status..." -ForegroundColor Yellow
try {
    $loginStatus = firebase projects:list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Logged in to Firebase" -ForegroundColor Green
    } else {
        Write-Host "❌ Not logged in. Please run: firebase login" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error checking login status" -ForegroundColor Red
    exit 1
}

# Step 3: Check current project
Write-Host ""
Write-Host "📋 Step 3: Verifying Firebase project..." -ForegroundColor Yellow
$currentProject = firebase use 2>&1
if ($currentProject -match $projectId) {
    Write-Host "✅ Using project: $projectId" -ForegroundColor Green
} else {
    Write-Host "⚠️  Setting project to: $projectId" -ForegroundColor Yellow
    firebase use $projectId
}

# Step 4: Check service account file
Write-Host ""
Write-Host "📋 Step 4: Checking service account credentials..." -ForegroundColor Yellow
$serviceAccountFiles = Get-ChildItem -Path "." -Filter "$projectId-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue
if ($serviceAccountFiles) {
    Write-Host "✅ Found service account file: $($serviceAccountFiles[0].Name)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service account file not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📥 To get service account credentials:" -ForegroundColor Cyan
    Write-Host "   1. Go to: $firebaseConsoleUrl/settings/serviceaccounts/adminsdk" -ForegroundColor White
    Write-Host "   2. Click 'Generate new private key'" -ForegroundColor White
    Write-Host "   3. Download the JSON file" -ForegroundColor White
    Write-Host "   4. Place it in the project root as: $projectId-firebase-adminsdk-*.json" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Continue with setup? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
}

# Step 5: Deploy security rules
Write-Host ""
Write-Host "📋 Step 5: Deploying Firestore and Storage rules..." -ForegroundColor Yellow
Write-Host "   This will deploy security rules for Firestore and Storage" -ForegroundColor Gray
$deployRules = Read-Host "Deploy rules now? (y/n)"
if ($deployRules -eq "y") {
    Write-Host "🚀 Deploying rules..." -ForegroundColor Cyan
    firebase deploy --only firestore:rules,storage:rules
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Rules deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Rules deployment failed" -ForegroundColor Red
    }
}

# Step 6: Check environment files
Write-Host ""
Write-Host "📋 Step 6: Checking environment files..." -ForegroundColor Yellow
if (Test-Path "server\client\.env") {
    Write-Host "✅ Client .env file exists" -ForegroundColor Green
} else {
    Write-Host "❌ Client .env file missing" -ForegroundColor Red
}

if (Test-Path "server\.env") {
    Write-Host "✅ Server .env file exists" -ForegroundColor Green
} else {
    Write-Host "❌ Server .env file missing" -ForegroundColor Red
}

# Step 7: Instructions for enabling services
Write-Host ""
Write-Host "📋 Step 7: Enable Firebase Services in Console" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please enable these services in Firebase Console:" -ForegroundColor Cyan
Write-Host "   🔐 Authentication: $firebaseConsoleUrl/authentication" -ForegroundColor White
Write-Host "   📊 Firestore: $firebaseConsoleUrl/firestore" -ForegroundColor White
Write-Host "   📦 Storage: $firebaseConsoleUrl/storage" -ForegroundColor White
Write-Host "   ⚡ Functions: $firebaseConsoleUrl/functions" -ForegroundColor White
Write-Host ""

# Step 8: Test connection
Write-Host "📋 Step 8: Testing Firebase connection..." -ForegroundColor Yellow
Write-Host "   Run the test script: node scripts/test-firebase-connection.js" -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "✅ Setup script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Enable services in Firebase Console (links above)" -ForegroundColor White
Write-Host "  2. Add service account credentials (if not done)" -ForegroundColor White
Write-Host "  3. Test the connection: node scripts/test-firebase-connection.js" -ForegroundColor White
Write-Host "  4. Start development: cd server/client && npm run dev" -ForegroundColor White
Write-Host ""

