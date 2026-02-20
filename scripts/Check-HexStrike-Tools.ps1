# Check HexStrike external tools installation and environment
# Usage: .\scripts\Check-HexStrike-Tools.ps1

$ToolsDir = "C:\Users\home\Desktop\hexstike.ai\hexstrike-tools"
$ServerUrl = "http://127.0.0.1:8888"

Write-Host "`n=== HexStrike tools check ===" -ForegroundColor Cyan
Write-Host ""

# PATH
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$toolsInPath = $userPath -like "*$ToolsDir*"
if ($toolsInPath) {
    Write-Host "[OK] Tools dir in user PATH" -ForegroundColor Green
} else {
    Write-Host "[!] Tools dir NOT in user PATH. Add it or re-run Install-HexStrike-Tools.ps1 and restart PowerShell." -ForegroundColor Yellow
    Write-Host "    Missing: $ToolsDir" -ForegroundColor Gray
}

# Nmap
$nmapOk = $false
try {
    $n = Get-Command nmap -ErrorAction Stop
    Write-Host "[OK] Nmap: $($n.Source)" -ForegroundColor Green
    $nmapOk = $true
} catch {
    Write-Host "[!] Nmap not found in PATH" -ForegroundColor Yellow
}

# Gobuster
$gobusterExe = "$ToolsDir\gobuster.exe"
if (Test-Path $gobusterExe) {
    Write-Host "[OK] Gobuster: $gobusterExe" -ForegroundColor Green
} else {
    Write-Host "[!] Gobuster not found at $gobusterExe" -ForegroundColor Yellow
}

# Nuclei
$nucleiExe = "$ToolsDir\nuclei.exe"
if (Test-Path $nucleiExe) {
    Write-Host "[OK] Nuclei: $nucleiExe" -ForegroundColor Green
} else {
    Write-Host "[!] Nuclei not found at $nucleiExe" -ForegroundColor Yellow
}

# SQLMap (wrapper or venv)
$sqlmapCmd = "$ToolsDir\sqlmap.cmd"
$python = "C:\Users\home\Desktop\hexstike.ai\hexstrike-ai\hexstrike-env\Scripts\python.exe"
if (Test-Path $sqlmapCmd) {
    Write-Host "[OK] SQLMap wrapper: $sqlmapCmd" -ForegroundColor Green
} elseif (Test-Path $python) {
    $null = & $python -m sqlmap --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[~] SQLMap: available via python -m sqlmap (no wrapper at $sqlmapCmd)" -ForegroundColor Yellow
    } else {
        Write-Host "[!] SQLMap: run 'pip install sqlmap' in HexStrike venv, then re-run Install-HexStrike-Tools.ps1" -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] SQLMap: HexStrike venv not found; install script creates wrapper there" -ForegroundColor Yellow
}

# Wordlist
$wl = "$ToolsDir\wordlists\common.txt"
if (Test-Path $wl) {
    $lines = (Get-Content $wl -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    Write-Host "[OK] Wordlist: $wl ($lines entries)" -ForegroundColor Green
} else {
    Write-Host "[!] Wordlist missing: $wl" -ForegroundColor Yellow
}

# HexStrike server
Write-Host ""
try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] HexStrike server: $ServerUrl (v$($health.version))" -ForegroundColor Green
    if ($health.tools_available) {
        Write-Host "     Tools reported by server: $($health.tools_available -join ', ')" -ForegroundColor Gray
    }
} catch {
    Write-Host "[~] HexStrike server not running at $ServerUrl" -ForegroundColor Gray
    Write-Host "    Start: cd C:\Users\home\Desktop\hexstike.ai\hexstrike-ai; .\run-server.ps1" -ForegroundColor Gray
}

Write-Host "`n=== Done ===`n" -ForegroundColor Cyan
