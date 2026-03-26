# Dot-source from start-gateway.ps1 / openclaw.ps1 so the Node process inherits API keys from
# %USERPROFILE%\.openclaw\.env (OpenClaw also reads this file; duplicating into Process env avoids edge cases).

$envFile = Join-Path $env:USERPROFILE ".openclaw\.env"
if (-not (Test-Path $envFile)) { return }

Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1, $val.Length - 2).Trim()
    }
    $val = $val -replace "`r", "" -replace "`n", ""
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') {
        Set-Item -Path "env:$name" -Value $val
    }
}
