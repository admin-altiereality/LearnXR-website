# Interactive: paste OpenAI API key (hidden), merge into %USERPROFILE%\.openclaw\.env.
# Do not open this file in Notepad to "run" it — run one of:
#   Double-click: scripts\openclaw\prompt-openai-key.cmd
#   PowerShell:   powershell -ExecutionPolicy Bypass -File .\scripts\openclaw\prompt-openai-key.ps1
# Create a key: https://platform.openai.com/api-keys

$ErrorActionPreference = "Stop"
Write-Host "Paste your OpenAI API key (input hidden; Enter when done)."
$secure = Read-Host -AsSecureString
if ($secure.Length -eq 0) { Write-Error "No input." }
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($BSTR)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) | Out-Null
}
$env:OPENAI_API_KEY = $plain
try {
    & (Join-Path $PSScriptRoot "apply-openai-env.ps1")
} finally {
    Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
}
Write-Host ""
Write-Host "Restart the gateway: .\scripts\openclaw\start-gateway.ps1 -- --force --verbose"
Write-Host "Note: errors that show C:\Users\you.openclaw\ mean C:\Users\you\.openclaw\ (display quirk)."
