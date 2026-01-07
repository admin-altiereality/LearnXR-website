# PowerShell script to list all available assistants and their configurations
# Usage: .\scripts\list-available-assistants.ps1 [-Avatar] [-Json]

param(
    [switch]$Avatar,
    [switch]$Json
)

# Get API base URL
function Get-ApiBaseUrl {
    if ($env:VITE_API_BASE_URL) {
        return $env:VITE_API_BASE_URL
    }
    
    if ($env:NODE_ENV -eq "development") {
        return "http://localhost:5001/in3devoneuralai/us-central1/api"
    }
    
    $region = "us-central1"
    $projectId = if ($env:VITE_FIREBASE_PROJECT_ID) { $env:VITE_FIREBASE_PROJECT_ID } else { "in3devoneuralai" }
    return "https://${region}-${projectId}.cloudfunctions.net/api"
}

$apiUrl = Get-ApiBaseUrl
$useAvatarKey = $Avatar.IsPresent
$url = "${apiUrl}/assistant/list?useAvatarKey=$useAvatarKey"

Write-Host "🔍 Fetching available assistants..." -ForegroundColor Cyan
Write-Host "📍 API URL: $url" -ForegroundColor Gray
Write-Host "🔑 Using Avatar Key: $useAvatarKey" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    $assistants = $response.assistants
    
    Write-Host "✅ Found $($assistants.Count) available assistant(s)" -ForegroundColor Green
    Write-Host ""
    
    if ($assistants.Count -eq 0) {
        Write-Host "⚠️  No assistants found. Make sure you have created assistants in OpenAI." -ForegroundColor Yellow
        Write-Host "   Assistants should be named in the format: '{Curriculum} {Class} {Subject} Teacher'" -ForegroundColor Yellow
        Write-Host "   Example: 'NCERT 10 Mathematics Teacher'" -ForegroundColor Yellow
        exit 0
    }
    
    if ($Json) {
        Write-Host "📄 JSON Output:" -ForegroundColor Cyan
        $assistants | ConvertTo-Json -Depth 10
        exit 0
    }
    
    # Group by curriculum
    $grouped = @{}
    foreach ($assistant in $assistants) {
        $curriculum = $assistant.curriculum
        $class = $assistant.class
        $subject = $assistant.subject
        
        if (-not $grouped[$curriculum]) {
            $grouped[$curriculum] = @{}
        }
        if (-not $grouped[$curriculum][$class]) {
            $grouped[$curriculum][$class] = @()
        }
        $grouped[$curriculum][$class] += $subject
    }
    
    # Display in a readable format
    Write-Host "📚 Available Assistant Configurations:" -ForegroundColor Cyan
    Write-Host ("═" * 60) -ForegroundColor Gray
    
    $sortedCurriculums = $grouped.Keys | Sort-Object
    foreach ($curriculum in $sortedCurriculums) {
        Write-Host ""
        Write-Host "📖 $curriculum" -ForegroundColor Yellow
        Write-Host ("─" * 60) -ForegroundColor Gray
        
        $sortedClasses = $grouped[$curriculum].Keys | Sort-Object { [int]$_ }
        foreach ($class in $sortedClasses) {
            $subjects = $grouped[$curriculum][$class] | Sort-Object
            Write-Host "  Class $class`:" -ForegroundColor White
            foreach ($subject in $subjects) {
                Write-Host "    • $subject" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    Write-Host ("═" * 60) -ForegroundColor Gray
    Write-Host ""
    Write-Host "📊 Summary: $($assistants.Count) total combination(s)" -ForegroundColor Cyan
    
    $uniqueCurriculums = ($assistants | Select-Object -Unique curriculum).Count
    $uniqueClasses = ($assistants | Select-Object -Unique class).Count
    $uniqueSubjects = ($assistants | Select-Object -Unique subject).Count
    
    Write-Host "   • $uniqueCurriculums unique curriculum(s)"
    Write-Host "   • $uniqueClasses unique class(es)"
    Write-Host "   • $uniqueSubjects unique subject(s)"
    
} catch {
    Write-Host "❌ Error fetching available assistants: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Yellow
    Write-Host "   • Make sure your server is running"
    Write-Host "   • Check that OPENAI_API_KEY or OPENAI_AVATAR_API_KEY is configured"
    Write-Host "   • Verify the API endpoint is accessible"
    exit 1
}

