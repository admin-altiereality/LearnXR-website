# Test LearnXR app with HexStrike.ai
# Usage: .\scripts\Test-LearnXR-WithHexStrike.ps1
# Or with custom URL: .\scripts\Test-LearnXR-WithHexStrike.ps1 -AppUrl "https://your-channel.web.app/"

param(
    [string]$AppUrl = "https://learnxr-evoneuralai--manav-fk25v518.web.app/"
)

$HexStrikeRoot = "C:\Users\home\Desktop\hexstike.ai\hexstrike-ai"
$ServerUrl = "http://127.0.0.1:8888"

Write-Host "`n=== LearnXR + HexStrike.ai Test ===" -ForegroundColor Cyan
Write-Host "Target URL: $AppUrl`n" -ForegroundColor Gray

# 1. Check if HexStrike server is running
try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 8 -ErrorAction Stop
    Write-Host "[OK] HexStrike server is running (v$($health.version))" -ForegroundColor Green
} catch {
    Write-Host "[!] HexStrike server not responding. Start it first:" -ForegroundColor Yellow
    Write-Host "    cd $HexStrikeRoot" -ForegroundColor Gray
    Write-Host "    .\run-server.ps1" -ForegroundColor Gray
    Write-Host "`nThen run this script again.`n" -ForegroundColor Yellow
    exit 1
}

# 2. Run analyze-target
Write-Host "`n[*] Running target analysis..." -ForegroundColor Cyan
$body = @{ target = $AppUrl.TrimEnd('/') + "/"; analysis_type = "comprehensive" } | ConvertTo-Json
$analysis = Invoke-RestMethod -Uri "$ServerUrl/api/intelligence/analyze-target" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60

if ($analysis.success) {
    $p = $analysis.target_profile
    Write-Host "`n--- Target profile ---" -ForegroundColor Cyan
    Write-Host "  Type:      $($p.target_type)"
    Write-Host "  Risk:      $($p.risk_level)"
    Write-Host "  Score:     $($p.attack_surface_score)"
    Write-Host "  Confidence: $($p.confidence_score)"
    if ($p.ip_addresses) { Write-Host "  IP(s):     $($p.ip_addresses -join ', ')" }
    Write-Host "  Security headers: $(if ($p.security_headers) { $p.security_headers | ConvertTo-Json -Compress } else { 'none detected' })"
    Write-Host "`n[OK] Analysis complete.`n" -ForegroundColor Green
} else {
    Write-Host "[!] Analysis failed.`n" -ForegroundColor Red
}

# 3. Optional: technology detection
Write-Host "[*] Technology detection..." -ForegroundColor Cyan
$body2 = @{ target = $AppUrl.TrimEnd('/') + "/" } | ConvertTo-Json
$tech = Invoke-RestMethod -Uri "$ServerUrl/api/intelligence/technology-detection" -Method Post -Body $body2 -ContentType "application/json" -TimeoutSec 30
if ($tech.success -and $tech.detected_technologies) {
    Write-Host "  Detected: $($tech.detected_technologies -join ', ')`n" -ForegroundColor Gray
}

Write-Host "Done. For full tool scans (nmap, nikto, etc.) install those tools or run HexStrike from WSL/Linux.`n" -ForegroundColor Gray
