<#
.SYNOPSIS
  Diagnose LearnXR WhatsApp + Twilio Conversations alignment (sandbox vs production).

.NOTES
  See: https://www.twilio.com/docs/conversations/use-twilio-sandbox-for-whatsapp
       https://www.twilio.com/docs/conversations/using-whatsapp-conversations
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root "server\.env"
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $k = $line.Substring(0, $eq).Trim()
  $v = $line.Substring($eq + 1).Trim()
  if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
    $v = $v.Substring(1, $v.Length - 2)
  }
  [Environment]::SetEnvironmentVariable($k, $v, "Process")
}

$AC = $env:TWILIO_ACCOUNT_SID.Trim()
$AUTH = $env:TWILIO_AUTH_TOKEN.Trim()
$MG = $env:TWILIO_MESSAGING_SERVICE_SID.Trim()
$IS = $env:TWILIO_CONVERSATIONS_SERVICE_SID.Trim()
if (-not $AC -or -not $AUTH) { throw "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN required in server/.env" }

$pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${AC}:${AUTH}"))

Write-Host "`n=== Conversations account configuration ===`n"
twilio api:conversations:v1:configuration:fetch -o json

Write-Host "`n=== CH count in configured service ($IS) ===`n"
twilio api:conversations:v1:services:conversations:list --chat-service-sid=$IS -o json

Write-Host "`n=== Address configurations (IG…) ===`n"
twilio api:conversations:v1:configuration:addresses:list -o json

if ($MG) {
  Write-Host "`n=== Messaging Service ($MG) + channel senders ===`n"
  curl.exe -sS "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: Basic $pair"
  Write-Host "`n"
  curl.exe -sS "https://messaging.twilio.com/v1/Services/$MG/ChannelSenders" -H "Authorization: Basic $pair"
}

Write-Host "`nDone. Compare defaultMessagingServiceSid from configuration:fetch with TWILIO_MESSAGING_SERVICE_SID in .env — they should match the MS that lists your whatsapp:+ sender.`n"
