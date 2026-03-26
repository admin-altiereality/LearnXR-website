# Run OpenClaw gateway with Node >= 22.16 (OpenClaw 2026.3.x requirement).
# System Node 22.13 fails the version check; this prefers portable Node 22.16.
#
# Usage (from repo or anywhere):
#   .\scripts\openclaw\start-gateway.ps1
#   .\scripts\openclaw\start-gateway.ps1 -- --force --verbose
#
# Extra args after -- are passed to: openclaw gateway run <args>

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
    Write-Host "Using portable Node: $node"
} else {
    $sys = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if ($sys -and (Test-NodeVersion $sys)) {
        $node = $sys
        Write-Host "Using PATH Node: $node"
    }
}

if (-not $node) {
    Write-Host @"

OpenClaw needs Node >= 22.16.0. Your PATH Node is too old or portable Node is missing.

Install portable Node 22.16 (one-time, no admin):

  `$zip = `"`$env:LOCALAPPDATA\node-portable-v22.16.0.zip`"
  `$dest = `"`$env:LOCALAPPDATA\node-portable-v22.16.0`"
  Invoke-WebRequest -Uri `"https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip`" -OutFile `$zip
  Expand-Archive -Path `$zip -DestinationPath `$dest -Force

Then re-run this script.

Or upgrade system Node: https://nodejs.org/en/download (22 LTS >= 22.16)

"@
    exit 1
}

$oc = Get-OpenclawMjs
Set-Location $env:USERPROFILE
. (Join-Path $PSScriptRoot "Import-OpenclawEnv.ps1")

$extra = @()
if ($args.Count -gt 0) {
    if ($args[0] -eq "--") {
        if ($args.Count -gt 1) { $extra = $args[1..($args.Count - 1)] }
    } else {
        $extra = $args
    }
}

Write-Host "Starting: gateway run (Node $($(& $node -v)))"
& $node $oc "gateway" "run" @extra
