# Install external security tools for HexStrike.ai on Windows
# Run in PowerShell (Admin recommended for winget/nmap). Then restart HexStrike server.

$ErrorActionPreference = "Stop"
$ToolsDir = "C:\Users\home\Desktop\hexstike.ai\hexstrike-tools"
$WordlistDir = "$ToolsDir\wordlists"

Write-Host "`n=== HexStrike.ai - Install external tools (Windows) ===" -ForegroundColor Cyan
Write-Host "Tools directory: $ToolsDir`n" -ForegroundColor Gray

# 1. Create directories
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $WordlistDir | Out-Null

# 2. Nmap (winget)
Write-Host "[1/5] Nmap..." -ForegroundColor Yellow
if (Get-Command nmap -ErrorAction SilentlyContinue) {
    Write-Host "  Nmap already installed: $(nmap -version 2>$null | Select-Object -First 1)" -ForegroundColor Green
} else {
    try {
        winget install --id Insecure.Nmap -e --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "  Nmap installed. If still not found, restart PowerShell." -ForegroundColor Green
    } catch {
        Write-Host "  Install manually: https://nmap.org/download.html" -ForegroundColor Yellow
    }
}

# 3. Gobuster (download Windows binary)
Write-Host "`n[2/5] Gobuster..." -ForegroundColor Yellow
$gobusterExe = "$ToolsDir\gobuster.exe"
if (Test-Path $gobusterExe) {
    Write-Host "  Gobuster already at $ToolsDir" -ForegroundColor Green
} else {
    $gobusterZip = "$ToolsDir\gobuster.zip"
    $gobusterUrl = "https://github.com/OJ/gobuster/releases/download/v3.8.2/gobuster_Windows_x86_64.zip"
    try {
        Invoke-WebRequest -Uri $gobusterUrl -OutFile $gobusterZip -UseBasicParsing
        Expand-Archive -Path $gobusterZip -DestinationPath $ToolsDir -Force
        $exe = Get-ChildItem -Path $ToolsDir -Filter "gobuster*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe -and $exe.FullName -ne $gobusterExe) { Move-Item $exe.FullName $gobusterExe -Force }
        Remove-Item $gobusterZip -Force -ErrorAction SilentlyContinue
        Write-Host "  Gobuster installed." -ForegroundColor Green
    } catch {
        Write-Host "  Download failed. Get it from: https://github.com/OJ/gobuster/releases" -ForegroundColor Yellow
    }
}

# 4. Nuclei (download Windows binary)
Write-Host "`n[3/5] Nuclei..." -ForegroundColor Yellow
$nucleiExe = "$ToolsDir\nuclei.exe"
if (Test-Path $nucleiExe) {
    Write-Host "  Nuclei already at $ToolsDir" -ForegroundColor Green
} else {
    $nucleiZip = "$ToolsDir\nuclei.zip"
    $nucleiUrl = "https://github.com/projectdiscovery/nuclei/releases/download/v3.7.0/nuclei_3.7.0_windows_amd64.zip"
    try {
        Invoke-WebRequest -Uri $nucleiUrl -OutFile $nucleiZip -UseBasicParsing
        Expand-Archive -Path $nucleiZip -DestinationPath $ToolsDir -Force
        $exe = Get-ChildItem -Path $ToolsDir -Filter "nuclei*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe -and $exe.FullName -ne $nucleiExe) { Move-Item $exe.FullName $nucleiExe -Force }
        Remove-Item $nucleiZip -Force -ErrorAction SilentlyContinue
        Write-Host "  Nuclei installed. Run '$nucleiExe -update-templates' once to get templates." -ForegroundColor Green
    } catch {
        Write-Host "  Download failed. Get it from: https://github.com/projectdiscovery/nuclei/releases" -ForegroundColor Yellow
    }
}

# 5. Nikto (optional - download Windows-friendly version or skip)
Write-Host "`n[4/5] Nikto..." -ForegroundColor Yellow
$niktoPath = "$ToolsDir\nikto"
if (Test-Path "$niktoPath\nikto.pl") {
    Write-Host "  Nikto already at $niktoPath" -ForegroundColor Green
} else {
    Write-Host "  Nikto requires Perl on Windows. Skipping (optional). Install Strawberry Perl + git clone https://github.com/sullo/nikto.git $niktoPath" -ForegroundColor Gray
}

# 6. SQLMap (pip)
Write-Host "`n[5/5] SQLMap..." -ForegroundColor Yellow
$python = "C:\Users\home\Desktop\hexstike.ai\hexstrike-ai\hexstrike-env\Scripts\python.exe"
$pip = "C:\Users\home\Desktop\hexstike.ai\hexstrike-ai\hexstrike-env\Scripts\pip.exe"
if (Test-Path $pip) {
    & $pip install sqlmap --quiet 2>$null
    $sqlmapScript = "C:\Users\home\Desktop\hexstike.ai\hexstrike-ai\hexstrike-env\Scripts\sqlmap.exe"
    if (Test-Path $sqlmapScript) {
        Write-Host "  SQLMap installed (venv). Creating wrapper in $ToolsDir so HexStrike finds it..." -ForegroundColor Green
        $wrapper = @"
@echo off
"$python" -m sqlmap %*
"@
        Set-Content -Path "$ToolsDir\sqlmap.cmd" -Value $wrapper
    }
} else {
    if (Get-Command sqlmap -ErrorAction SilentlyContinue) {
        Write-Host "  SQLMap already in PATH." -ForegroundColor Green
    } else {
        pip install sqlmap 2>$null
        Write-Host "  If pip install sqlmap worked, ensure Python Scripts is in PATH." -ForegroundColor Yellow
    }
}

# 7. Wordlist for Gobuster (minimal)
$wordlistPath = "$WordlistDir\common.txt"
if (-not (Test-Path $wordlistPath)) {
    $common = @(
        "login","admin","api","dashboard","signup","logout","forgot-password",
        "profile","settings","assets","static","dist","index.html","manifest.json",
        "robots.txt","sitemap.xml",".env","config","health","version"
    )
    $common | Set-Content -Path $wordlistPath
    Write-Host "`n  Created wordlist: $wordlistPath" -ForegroundColor Green
}

# 8. Add ToolsDir to user PATH
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$ToolsDir*") {
    [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$ToolsDir", "User")
    Write-Host "`n  Added $ToolsDir to user PATH. Restart PowerShell/terminal for it to take effect." -ForegroundColor Green
} else {
    Write-Host "`n  $ToolsDir already in PATH." -ForegroundColor Green
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart PowerShell (or open a new terminal) so PATH is updated." -ForegroundColor Gray
Write-Host "  2. Run: nuclei -update-templates   (from $ToolsDir or after adding to PATH)" -ForegroundColor Gray
Write-Host "  3. Restart the HexStrike server (.\run-server.ps1 in hexstike.ai\hexstrike-ai)." -ForegroundColor Gray
Write-Host "  4. Re-run your LearnXR test script or smart-scan.`n" -ForegroundColor Gray
