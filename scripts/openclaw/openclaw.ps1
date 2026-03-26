# Run the OpenClaw CLI with Node >= 22.16 (required by openclaw 2026.3.x).
# Global `openclaw` uses whatever `node` is first on PATH — often 22.13, which fails.
# This script prefers portable Node 22.16 under %LOCALAPPDATA%, same as start-gateway.ps1.
#
# Usage (from repo root or anywhere):
#   .\scripts\openclaw\openclaw.ps1 models status
#   .\scripts\openclaw\openclaw.ps1 dashboard
#   .\scripts\openclaw\openclaw.ps1 gateway run --force --verbose

$ErrorActionPreference = "Stop"

function Get-OpenclawMjs {
    $p = Join-Path $env:APPDATA "npm\node_modules\openclaw\openclaw.mjs"
    if (Test-Path $p) { return $p }
    $p2 = Join-Path $env:ProgramFiles "nodejs\node_modules\openclaw\openclaw.mjs"
    if (Test-Path $p2) { return $p2 }
    throw "openclaw.mjs not found. Install: npm i -g openclaw@latest"
}

function Test-NodeVersion([string]$nodeExe) {
    $v = & $nodeExe -v 2>$null
    if ($v -match '^v(\d+)\.(\d+)\.(\d+)') {
        $maj = [int]$Matches[1]; $min = [int]$Matches[2]; $pat = [int]$Matches[3]
        return ($maj -gt 22) -or ($maj -eq 22 -and $min -gt 16) -or ($maj -eq 22 -and $min -eq 16 -and $pat -ge 0)
    }
    return $false
}

$portable = Join-Path $env:LOCALAPPDATA "node-portable-v22.16.0\node-v22.16.0-win-x64\node.exe"
$node = $null
if ((Test-Path $portable) -and (Test-NodeVersion $portable)) {
    $node = $portable
} else {
    $sys = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if ($sys -and (Test-NodeVersion $sys)) {
        $node = $sys
    }
}

if (-not $node) {
    $here = Join-Path $PSScriptRoot "install-portable-node.ps1"
    Write-Host @"

OpenClaw needs Node >= 22.16.0. Portable Node not found and PATH Node is too old.

Run once (no admin):
  powershell -ExecutionPolicy Bypass -File `"$here`"

Or upgrade Node: https://nodejs.org/en/download (22.x >= 22.16)

"@
    exit 1
}

$oc = Get-OpenclawMjs
Set-Location $env:USERPROFILE
. (Join-Path $PSScriptRoot "Import-OpenclawEnv.ps1")
& $node $oc @args
exit $LASTEXITCODE
