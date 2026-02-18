# Baseline security checks for LearnXR API (localhost:5002 only).
# Run with: .\scripts\security-baseline-check.ps1
# Requires: LearnXR backend running (npm run dev from repo root).

$baseUrl = "http://localhost:5002"
$outDir = Join-Path (Join-Path $PSScriptRoot "..") "security-test-runs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $outDir "baseline-$timestamp.txt"

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$results = @()
$results += "=== LearnXR baseline security check ==="
$results += "Target: $baseUrl (localhost only)"
$results += "Date: $(Get-Date -Format o)"
$results += ""

# Health check
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 5
    $results += "[PASS] GET /health -> $($health.StatusCode)"
    $results += "  Content: $($health.Content)"
} catch {
    $results += "[FAIL/SKIP] GET /health -> $($_.Exception.Message)"
}
$results += ""

# API routes (expect 401/403 or 400 for unauthenticated/bad request - not 500)
$endpoints = @("/api/payment", "/api/user", "/api/assistant", "/api/auth")
foreach ($path in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri "$baseUrl$path" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        $results += "[INFO] GET $path -> $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($null -eq $code) { $code = "N/A" }
        $results += "[INFO] GET $path -> $code or error (expected without auth)"
    }
}
$results += ""

# Security headers (if health responded)
try {
    $h = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 3
    $results += "Response headers (health):"
    $h.Headers.Keys | ForEach-Object { $results += "  $_ : $($h.Headers[$_])" }
} catch {}
$results += ""

$results += "=== End baseline check ==="

$text = $results -join "`r`n"
Set-Content -Path $reportFile -Value $text -Encoding UTF8
Write-Host $text
Write-Host "`nOutput saved to: $reportFile"
