# Writes ANTHROPIC_API_KEY to ~/.openclaw/.env so the OpenClaw gateway loads it on startup.
# Docs: https://docs.openclaw.ai/help/environment
#
# Usage (PowerShell):
#   $env:ANTHROPIC_API_KEY = "sk-ant-api03-..."   # your key from https://console.anthropic.com/
#   ./scripts/openclaw/apply-anthropic-env.ps1
#
# Then restart: openclaw gateway run   (or your service)
# Verify:  openclaw models status --json   (missingProvidersInUse should not list anthropic)

$ErrorActionPreference = "Stop"
$key = $env:ANTHROPIC_API_KEY
if (-not $key -or $key.Trim().Length -eq 0) {
    Write-Error "Set environment variable ANTHROPIC_API_KEY to your Anthropic API key first."
}
# Avoid 401 invalid x-api-key: trim, strip wrapping quotes, kill CR/newlines from bad pastes
$key = $key.Trim()
if (($key.StartsWith('"') -and $key.EndsWith('"')) -or ($key.StartsWith("'") -and $key.EndsWith("'"))) {
    $key = $key.Substring(1, $key.Length - 2).Trim()
}
$key = $key -replace "`r", "" -replace "`n", ""
if ($key -notmatch '^sk-ant-') {
    Write-Warning "Key should start with sk-ant- (API keys: sk-ant-api03-...). Setup-tokens look different; see https://docs.openclaw.ai/providers/anthropic"
}
$dir = Join-Path $env:USERPROFILE ".openclaw"
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}
$path = Join-Path $dir ".env"
# UTF-8 no BOM for dotenv parsers; single line value (no quotes in file)
$content = "ANTHROPIC_API_KEY=$key`n"
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $path"
Write-Host "Restart the OpenClaw gateway, then run: openclaw models status"
