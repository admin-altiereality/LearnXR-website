---
name: openclaw-paperclip
description: "OpenClaw plus Paperclip — gateway, dashboard, WhatsApp channel, CEO openclaw/invite-prompt API; use with the paperclip skill for tasks."
---

# OpenClaw + Paperclip

Use this skill when work spans **OpenClaw** (gateway, channels, dashboard) and **Paperclip** (company tasks, agent identity, governance).

## Boundaries

- **Paperclip**: assignments, checkouts, issue comments, approvals, hiring, company skills API. Follow the **paperclip** skill for heartbeats and API details.
- **OpenClaw**: local gateway WebSocket, Control UI, channel plugins (e.g. WhatsApp), `openclaw` CLI. OpenClaw does not replace Paperclip task state — sync outcomes back to Paperclip via comments/status.

## OpenClaw runtime (local)

- Default gateway: `ws://127.0.0.1:18789` (adjust if you use `--dev` / custom port).
- Control UI: `http://127.0.0.1:18789/` — open with `openclaw dashboard` so the `#token=…` hash matches `gateway.auth.token` in `~/.openclaw/openclaw.json` (Windows: `C:\Users\<you>\.openclaw\openclaw.json`).
- **Node**: OpenClaw 2026.3.x expects **Node ≥ 22.16.0**. If the global `openclaw` command fails version checks, run the CLI with a compatible Node binary (see your team runbook or portable Node).

## CEO: onboard an OpenClaw-side employee

Paperclip can mint a short-lived **OpenClaw invite prompt** (CEO or board with invite permission):

```http
POST /api/companies/{companyId}/openclaw/invite-prompt
Content-Type: application/json

{
  "agentMessage": "Optional note for the joining OpenClaw agent"
}
```

Use the response **`onboardingTextUrl`** (fetch that URL for the full prompt text). When sharing with the board or pasting into OpenClaw, include your gateway URL (e.g. `ws://127.0.0.1:18789`) wherever the payload expects `agentDefaultsPayload.url`.

After OpenClaw submits a join request, continue in Paperclip: approvals, API key claim, and skill assignment per your org process.

## WhatsApp (OpenClaw channel)

- Linking is **WhatsApp → Linked devices** QR via `openclaw channels login --channel whatsapp` (gateway must be running).
- Access control lives in **`channels.whatsapp`** in `openclaw.json` (`dmPolicy`, `allowFrom`, `groupPolicy`, etc.). Keep allowlists aligned with who may trigger the agent.

## Quick CLI reference

```bash
openclaw gateway run --verbose
openclaw dashboard
openclaw channels status
openclaw health
openclaw doctor
```

## Related

- Paperclip API: `POST /api/companies/:companyId/openclaw/invite-prompt` (see company API reference).
- OpenClaw docs: https://docs.openclaw.ai/
