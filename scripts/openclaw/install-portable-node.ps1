# Download and unpack Node.js 22.16.0 win-x64 under %LOCALAPPDATA% (no admin).
# Used by openclaw.ps1 / start-gateway.ps1 when system Node is < 22.16.

$ErrorActionPreference = "Stop"
$ver = "22.16.0"
$zipName = "node-v$ver-win-x64.zip"
$base = Join-Path $env:LOCALAPPDATA "node-portable-v22.16.0"
$zip = Join-Path $env:TEMP $zipName
$url = "https://nodejs.org/dist/v$ver/$zipName"

New-Item -ItemType Directory -Path $base -Force | Out-Null
Write-Host "Downloading $url ..."
Invoke-WebRequest -Uri $url -OutFile $zip
Write-Host "Extracting to $base ..."
Expand-Archive -Path $zip -DestinationPath $base -Force
Remove-Item $zip -Force
$nodeExe = Join-Path $base "node-v$ver-win-x64\node.exe"
if (-not (Test-Path $nodeExe)) { throw "Expected $nodeExe after extract" }
Write-Host "OK:" (& $nodeExe -v)
Write-Host "Use: .\scripts\openclaw\openclaw.ps1 models status"
