# Altie Reality: Paperclip + n8n orchestration

Operational pack for mapping **Paperclip** (local) to **n8n** (`https://n8n.altiereality.com`) under company **Altie Reality Private Limited**.

| Document | Purpose |
|----------|---------|
| [WORKFLOW_INVENTORY.md](./WORKFLOW_INVENTORY.md) | Classify workflows; run export script to seed the inventory table |
| [ORG_MAP.md](./ORG_MAP.md) | Paperclip projects, integration vs LLM agents, allowlists |
| [ASSIGNMENT_MATRIX.md](./ASSIGNMENT_MATRIX.md) | Task templates, success criteria, bridge `workflowKey` values |
| [SECURITY.md](./SECURITY.md) | API keys, bridge secret, rotation |

## Quick smoke test (bridge + n8n API)

Does not start the full LearnXR server (faster if the main app is slow to boot):

```bash
cd server
npm run smoke:paperclip-n8n
```

This listens briefly on port **5055**, checks `/health`, `/api/paperclip-n8n/health`, posts a test **`ui-pdf-to-vr-lesson`** trigger, then queries n8n executions. Override port: `npx tsx src/scripts/smoke-paperclip-n8n.ts --port 5056`.

## LearnXR server integration

- **n8n proxy** (executions): `GET /api/n8n/executions`, `GET /api/n8n/executions/:id` — see [server/src/routes/n8n.ts](../../server/src/routes/n8n.ts).
- **Paperclip bridge** (trigger allowlisted webhooks): `POST /api/paperclip-n8n/trigger` — see [server/src/routes/paperclipN8nBridge.ts](../../server/src/routes/paperclipN8nBridge.ts).
- Copy [server/src/config/paperclip-n8n-workflows.example.json](../../server/src/config/paperclip-n8n-workflows.example.json) to [`server/config/paperclip-n8n-workflows.json`](../../server/config/) (gitignored) and set env vars per [SECURITY.md](./SECURITY.md).

## Export workflows from n8n

From the `server` directory, with `N8N_API_URL` and `N8N_API_KEY` set:

```bash
# Recommended on Windows:
npx tsx src/scripts/export-n8n-workflows.ts --out ../docs/altie-paperclip-n8n/workflow-export.generated.json

# Or:
npm run export-n8n-workflows -- --out ../docs/altie-paperclip-n8n/workflow-export.generated.json
```

`N8N_API_KEY` in `server/.env` can match **n8nUIinterface-main** `VITE_N8N_API_KEY` for REST access (keep that key server-side in LearnXR; avoid duplicating secrets in new client bundles).

Run the API and export script with **`server/` as the current working directory** so `server/config/paperclip-n8n-workflows.json` resolves correctly.

### n8n MCP (Cursor)

If you expected **n8n MCP** tools here, check **Cursor Settings → MCP**: the `user-n8n-mcp` server must show as connected. When it errors, use the REST export script and n8n **Settings → API** key instead.

## n8n workflow checklist (correlation + auth)

1. On webhook-triggered workflows, read **`correlationId`** from the JSON body (added by the LearnXR bridge or the lead route).
2. Pass it through a **Set** node into CRM, Sheets, Slack, or logs so Paperclip tickets and n8n executions stay joinable.
3. Enable **webhook authentication** in n8n where supported; for header secrets, use `webhookSecretHeader` in the workflow map as described in [ASSIGNMENT_MATRIX.md](./ASSIGNMENT_MATRIX.md).
