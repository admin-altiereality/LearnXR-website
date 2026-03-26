# Merges OPENAI_API_KEY into ~/.openclaw/.env (keeps other lines, e.g. ANTHROPIC_API_KEY).
# Docs: https://docs.openclaw.ai/help/environment
#
# Usage (PowerShell):
#   $env:OPENAI_API_KEY = "sk-proj-..."   # or sk-... from https://platform.openai.com/api-keys
#   ./scripts/openclaw/apply-openai-env.ps1
#
# Ensure openclaw.json agents.defaults.model.primary uses an OpenAI model (e.g. openai/gpt-5.4).
# Restart: ./scripts/openclaw/start-gateway.ps1 -- --force --verbose
# Verify:  openclaw models status

$ErrorActionPreference = "Stop"
$key = $env:OPENAI_API_KEY
if (-not $key -or $key.Trim().Length -eq 0) {
    Write-Error "Set environment variable OPENAI_API_KEY to your OpenAI API key first."
}
$key = $key.Trim()
if (($key.StartsWith('"') -and $key.EndsWith('"')) -or ($key.StartsWith("'") -and $key.EndsWith("'"))) {
    $key = $key.Substring(1, $key.Length - 2).Trim()
}
$key = $key -replace "`r", "" -replace "`n", ""
if ($key -notmatch '^sk-') {
    Write-Warning "OpenAI secret keys usually start with sk- or sk-proj-. Double-check you pasted an API key, not a different token."
}
$dir = Join-Path $env:USERPROFILE ".openclaw"
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}
$path = Join-Path $dir ".env"
$lines = @()
if (Test-Path $path) {
    $lines = @(Get-Content -Path $path -ErrorAction Stop)
}
$out = New-Object System.Collections.Generic.List[string]
$replaced = $false
foreach ($line in $lines) {
    if ($line -match '^\s*OPENAI_API_KEY=') {
        [void]$out.Add("OPENAI_API_KEY=$key")
        $replaced = $true
    } else {
        [void]$out.Add($line)
    }
}
if (-not $replaced) {
    [void]$out.Add("OPENAI_API_KEY=$key")
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, ($out -join "`n") + "`n", $utf8NoBom)
Write-Host "Updated $path (OPENAI_API_KEY merged; other lines preserved)."
Write-Host "Restart the OpenClaw gateway, then run: openclaw models status"
