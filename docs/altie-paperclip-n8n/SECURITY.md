# Security: Paperclip + n8n (Altie Reality)

## Secrets overview

| Secret | Where | Purpose |
|--------|-------|---------|
| `N8N_API_KEY` | LearnXR server `.env` | n8n REST API (export script, `/api/n8n/executions*`) |
| `PAPERCLIP_BRIDGE_SECRET` | LearnXR server `.env` | Bearer auth for `POST /api/paperclip-n8n/trigger` |
| Per-webhook secret | n8n workflow + optional header | Harden public webhooks (configure in n8n; optional header in workflow map) |
| `paperclip-n8n-workflows.json` | `server/config/` (gitignored) | Maps `workflowKey` → webhook URL/path only—no API keys in file |

**n8nUIinterface-main:** `VITE_N8N_API_KEY` is bundled for the browser—anyone can extract it. Prefer a **dedicated** n8n API key for LearnXR `server/.env` only, and rotate the shared key if it was ever shipped in a public build.

## Environment variables

Set in `server/.env` (never commit):

```env
# n8n (existing)
N8N_API_URL=https://n8n.altiereality.com
N8N_API_KEY=

# Public base for building webhook URLs in the bridge (no trailing slash)
PAPERCLIP_N8N_PUBLIC_BASE=https://n8n.altiereality.com

# Bridge auth (generate: openssl rand -hex 32)
PAPERCLIP_BRIDGE_SECRET=

# Optional: path to workflow map (default: server/config/paperclip-n8n-workflows.json)
# PAPERCLIP_N8N_WORKFLOWS_PATH=
```

## Provision `PAPERCLIP_BRIDGE_SECRET`

1. Generate a long random string (e.g. `openssl rand -hex 32`).
2. Store only in LearnXR server env and in Paperclip integration agent config (not in task text).
3. Rotate on agent compromise or team change: generate new secret, update server, update Paperclip, revoke old.

## n8n API key

- Create a dedicated key in n8n for **automation / LearnXR** with minimal scope if your n8n version supports it.
- Rotate: create new key, update `N8N_API_KEY`, delete old key in n8n.

## Webhook hardening (n8n side)

- Enable authentication on webhook nodes where available.
- If you use a shared secret header, add `webhookSecretHeader` to the workflow map entry (see example JSON) so the bridge sends it without embedding the raw secret in Paperclip tasks.

## Network

- Local Paperclip and LearnXR server must be able to reach `https://n8n.altiereality.com` outbound.
- The bridge does not expose n8n credentials to Paperclip—only the bridge Bearer token.

## Rotation checklist

1. Generate new `PAPERCLIP_BRIDGE_SECRET` (or `N8N_API_KEY`).
2. Update `server/.env` and restart LearnXR API.
3. Update Paperclip agent env for integration agents.
4. Remove old secret from n8n or env stores.
5. Record date and owner in your internal ops log.
