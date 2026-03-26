<#
.SYNOPSIS
  Route WhatsApp inbound through Conversations (LearnXR inbox) while still hitting n8n.

.DESCRIPTION
  Twilio only applies one primary inbound path on a Messaging Service: a Programmable
  Messaging Inbound Request URL competes with Conversations autocreation. This script:

  1) Backs up the current Messaging Service + Conversations Address Configuration.
  2) Clears MessagingService.InboundRequestUrl (via REST) so Address Configuration can autocreate CH threads.
  3) Sets the WhatsApp Address Configuration to autoCreation.type=webhook with your n8n URL.
     Twilio then attaches a conversation-scoped webhook: n8n receives onParticipantAdded / onMessageAdded
     as Conversations webhook JSON (not the old Incoming-SMS form POST).

  Requires: twilio-cli (authenticated), curl.exe, server\.env with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.

.PARAMETER DryRun
  Only fetch and print backup JSON; do not change Twilio.

.PARAMETER RollbackPath
  Path to a JSON file written by a previous run (*-twilio-inbox-n8n-backup-*.json). Restores MS inbound URL
  and sets address autoCreation back to type "default" (removes per-conversation n8n webhook URL).

.EXAMPLE
  cd server
  .\scripts\twilio-conversations-n8n-bypass.ps1

.EXAMPLE
  .\scripts\twilio-conversations-n8n-bypass.ps1 -RollbackPath .\scripts\_twilio-inbox-n8n-backup-20260325.json
#>
param(
  [switch] $DryRun,
  [string] $RollbackPath = ""
)

$ErrorActionPreference = "Stop"
$ServerRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ServerRoot ".env"

function Read-DotEnv {
  param([string] $Path)
  if (-not (Test-Path $Path)) { throw "Missing env file: $Path" }
  Get-Content $Path | ForEach-Object {
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
}

function Get-BasicAuthHeader {
  param([string] $Sid, [string] $Token)
  $pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Sid}:${Token}"))
  return "Basic $pair"
}

function WaAddressFromEnv {
  param([string] $From)
  if (-not $From) { return $null }
  $t = $From.Trim()
  if ($t.ToLowerInvariant().StartsWith("whatsapp:")) { return $t }
  $d = ($t -replace "\D", "")
  if (-not $d) { return $null }
  return "whatsapp:+${d}"
}

Read-DotEnv $EnvPath

$AC = $env:TWILIO_ACCOUNT_SID.Trim()
$AUTH = $env:TWILIO_AUTH_TOKEN.Trim()
$MG = $env:TWILIO_MESSAGING_SERVICE_SID.Trim()
$IS = $env:TWILIO_CONVERSATIONS_SERVICE_SID.Trim()
$n8nUrl = if ($env:TWILIO_N8N_CONVERSATIONS_WEBHOOK_URL) { $env:TWILIO_N8N_CONVERSATIONS_WEBHOOK_URL.Trim() } else { "" }

if (-not $AC -or -not $AUTH) { throw "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in server/.env" }
if (-not $MG) { throw "Set TWILIO_MESSAGING_SERVICE_SID in server/.env" }
if (-not $IS) { throw "Set TWILIO_CONVERSATIONS_SERVICE_SID in server/.env" }

$env:TWILIO_ACCOUNT_SID = $AC
$env:TWILIO_AUTH_TOKEN = $AUTH

$authZ = Get-BasicAuthHeader $AC $AUTH

$igSid = if ($env:TWILIO_CONVERSATIONS_ADDRESS_CONFIG_SID) { $env:TWILIO_CONVERSATIONS_ADDRESS_CONFIG_SID.Trim() } else { "" }
if (-not $igSid) {
  $wantAddr = WaAddressFromEnv $env:TWILIO_WHATSAPP_FROM
  $listJson = twilio api:conversations:v1:configuration:addresses:list -o json 2>&1
  if ($LASTEXITCODE -ne 0) { throw $listJson }
  $rows = $listJson | ConvertFrom-Json
  foreach ($r in $rows) {
    if ($wantAddr -and [string]$r.address -eq $wantAddr) { $igSid = [string]$r.sid; break }
  }
  if (-not $igSid -and $rows.Count -eq 1) { $igSid = [string]$rows[0].sid }
}
if (-not $igSid) {
  throw "Set TWILIO_CONVERSATIONS_ADDRESS_CONFIG_SID (IG) or TWILIO_WHATSAPP_FROM so the script can match a single Address Configuration."
}

if ($RollbackPath) {
  if (-not (Test-Path $RollbackPath)) { throw "Rollback file not found: $RollbackPath" }
  $snap = Get-Content $RollbackPath -Raw | ConvertFrom-Json
  $oldInbound = [string]$snap.messagingService.inbound_request_url
  $oldMethod = [string]$snap.messagingService.inbound_method
  if (-not $oldMethod) { $oldMethod = "GET" }
  $ig = [string]$snap.addressConfiguration.sid
  Write-Host "Rollback: restoring MS $MG inbound URL and address $ig to default autocreate."
  if ($oldInbound) {
    $body = "InboundRequestUrl=" + [uri]::EscapeDataString($oldInbound) + "&InboundMethod=" + [uri]::EscapeDataString($oldMethod)
    curl.exe -sS -X POST "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: $authZ" -H "Content-Type: application/x-www-form-urlencoded" -d $body | Out-Host
  } else {
    curl.exe -sS -X POST "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: $authZ" -d "InboundRequestUrl=" | Out-Host
  }
  twilio api:conversations:v1:configuration:addresses:update --sid $ig `
    --auto-creation.enabled `
    --auto-creation.type default `
    --auto-creation.conversation-service-sid $IS `
    -o json | Out-Host
  Write-Host "Rollback done."
  exit 0
}

if (-not $n8nUrl) {
  Write-Host "TWILIO_N8N_CONVERSATIONS_WEBHOOK_URL is empty - trying Messaging Service inbound_request_url..."
  $msJson = curl.exe -sS "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: $authZ"
  $ms = $msJson | ConvertFrom-Json
  $n8nUrl = [string]$ms.inbound_request_url
}
if (-not $n8nUrl) {
  Write-Host "Trying Address Configuration webhook_url (IG $igSid)..."
  $igProbe = twilio api:conversations:v1:configuration:addresses:fetch --sid $igSid -o json
  if ($LASTEXITCODE -eq 0) {
    $igP = $igProbe | ConvertFrom-Json
    if ($igP -is [Array]) { $igP = $igP[0] }
    $ac = $igP.autoCreation
    if ($ac) {
      $n8nUrl = [string]$ac.webhook_url
      if (-not $n8nUrl) { $n8nUrl = [string]$ac.webhookUrl }
    }
  }
}
if (-not $n8nUrl) {
  throw "Set TWILIO_N8N_CONVERSATIONS_WEBHOOK_URL in server/.env to your n8n webhook (HTTPS). Example: https://n8n.example.com/webhook/..."
}

$backupName = "_twilio-inbox-n8n-backup-{0:yyyyMMdd-HHmmss}.json" -f (Get-Date)
$backupPath = Join-Path $PSScriptRoot $backupName

$msNow = curl.exe -sS "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: $authZ"
$igNow = twilio api:conversations:v1:configuration:addresses:fetch --sid $igSid -o json
if ($LASTEXITCODE -ne 0) { throw $igNow }

$igObj = $igNow | ConvertFrom-Json
if ($igObj -is [Array]) { $igObj = $igObj[0] }

$snapshot = [ordered]@{
  savedAt       = (Get-Date).ToString("o")
  messagingService = ($msNow | ConvertFrom-Json)
  addressConfiguration = $igObj
}
if ($DryRun) {
  Write-Host "DryRun: would write backup to $backupPath (skipped). No Twilio changes."
  exit 0
}

$snapshot | ConvertTo-Json -Depth 20 | Set-Content -Path $backupPath -Encoding UTF8
Write-Host "Wrote backup: $backupPath"

Write-Host "Clearing Messaging Service inbound_request_url (enables Conversations path for this MS)..."
curl.exe -sS -X POST "https://messaging.twilio.com/v1/Services/$MG" -H "Authorization: $authZ" -d "InboundRequestUrl=" | Out-Host

Write-Host "Updating Address $igSid - autoCreation.type=webhook -> $n8nUrl"
twilio api:conversations:v1:configuration:addresses:update --sid $igSid `
  --auto-creation.enabled `
  --auto-creation.type webhook `
  --auto-creation.conversation-service-sid $IS `
  --auto-creation.webhook-url $n8nUrl `
  --auto-creation.webhook-method post `
  --auto-creation.webhook-filters onMessageAdded onParticipantAdded `
  -o json | Out-Host

Write-Host ""
Write-Host "Done. Send a test WhatsApp message, then:"
Write-Host "  twilio api:conversations:v1:services:conversations:list --chat-service-sid=$IS -o json"
Write-Host ""
Write-Host "n8n now receives Conversations webhook JSON (not Programmable Messaging form fields). See https://www.twilio.com/docs/conversations/conversations-webhooks"
Write-Host ""
Write-Host "Rollback:"
Write-Host "  .\scripts\twilio-conversations-n8n-bypass.ps1 -RollbackPath `"$backupPath`""
