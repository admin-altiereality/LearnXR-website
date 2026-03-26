$ErrorActionPreference = "Continue"
try {
    $env:PAPERCLIP_COMPANY_ID="ef83bc97-7d29-4e99-9ad0-4c48aa25e978"
    Set-Location -Path "C:\Users\home\Desktop\LearnXRLMS\LearnXR-website"
    node scripts/paperclip/audit-openclaw-capabilities.mjs 2>&1 | Out-File "C:\Users\home\Desktop\LearnXRLMS\LearnXR-website\audit_results.txt"
} catch {
    $_.Exception.Message | Out-File "C:\Users\home\Desktop\LearnXRLMS\LearnXR-website\audit_results_err.txt"
}
