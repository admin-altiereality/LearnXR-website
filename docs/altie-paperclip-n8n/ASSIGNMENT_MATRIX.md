# Assignment matrix: Paperclip ↔ n8n (Altie Reality)

Living document for task authors and integration agents. **First line of a Paperclip task** should name the `workflowKey` (if using the bridge) or the webhook path.

## Correlation ID convention

- Every on-demand run must include a **`correlationId`**: Paperclip ticket id, execution id, or UUID.
- The LearnXR **bridge** always merges `correlationId` into the JSON body sent to n8n.
- The **lead** webhook includes `correlationId` (client-supplied or server-generated) for traceability—propagate it in n8n (Set node → CRM/sheets).

## Bridge base URL (Paperclip HTTP agent)

- Local API: `http://localhost:<SERVER_PORT>/api/paperclip-n8n/trigger` (use your real host if Paperclip runs elsewhere).
- Auth: `Authorization: Bearer <PAPERCLIP_BRIDGE_SECRET>`
- Body: `{ "workflowKey": string, "correlationId"?: string, "payload": object }`

## Matrix

| Paperclip project | Agent (example) | workflowKey | n8n workflow id | Task template (payload fields) | Success criteria |
|-------------------|-----------------|-------------|-----------------|--------------------------------|------------------|
| Growth | `integrations-growth` | `learnxr-website-lead` | LjnY0nmY8hNTDY6p or 0Mwe1RC5d73VtyTS | Lead fields + `correlationId` | HTTP 2xx; execution success |
| Content | `integrations-content` | `ui-pdf-to-vr-lesson` | M2JtKrQffsQnNOYR | Payload expected by UI PDF→VR webhook (`b8608c3e`) + `correlationId` | HTTP 2xx; execution success |
| Growth | `integrations-growth` | _(add after path known)_ | bJQC23r5at0P8qdA | Per funnel contract + `correlationId` | Allowlist in `paperclip-n8n-workflows.json` first |

Add one row per **on-demand** workflow. For **event-only** workflows, add a row with execution_model = event-driven and note "monitor via `/api/n8n/executions` only."

### Optional: webhook auth in the workflow map

If the n8n Webhook node expects a secret header, extend the map entry and set the value in `server/.env` (never in the JSON file):

```json
{
  "my-secured-workflow": {
    "webhookPath": "path-from-n8n-webhook-node",
    "webhookSecretHeader": {
      "headerName": "X-N8N-Webhook-Secret",
      "envVar": "N8N_WEBHOOK_SECRET_MYWORKFLOW"
    }
  }
}
```

## Task description template

```
workflowKey: <key>
correlationId: <ticket-or-uuid>
n8n UI: https://n8n.altiereality.com/workflow/<id>

Payload:
- field1: ...
- field2: ...

Done when:
- Bridge returns 2xx and n8n execution succeeded (check execution id if returned).
```
