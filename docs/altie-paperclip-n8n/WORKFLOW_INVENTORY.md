# n8n workflow inventory (Altie Reality)

Use this as the **single source of truth** for company-owned automation. Regenerate machine columns from [`workflow-export.generated.json`](./workflow-export.generated.json) (run export script after n8n changes).

## Export script

From `server/`:

```bash
npx tsx src/scripts/export-n8n-workflows.ts --out ../docs/altie-paperclip-n8n/workflow-export.generated.json
```

(`npm run export-n8n-workflows -- --out ../docs/altie-paperclip-n8n/workflow-export.generated.json` also works; on Windows, `npx tsx ... --out` is the most reliable.)

Requires `N8N_API_URL` and `N8N_API_KEY` in **`server/.env`** (loaded automatically).

If listed workflows omit `nodes` and `inferred_trigger` is mostly `other`, run with `EXPORT_N8N_INCLUDE_NODES=1` so the script fetches each workflow by id (slower, more accurate triggers).

## Classification lanes

| Lane | Examples |
|------|----------|
| **Inbound / growth** | Lead capture, forms, ads, sales funnel |
| **Content / LMS** | Lesson builder, PDF→VR, asset pipelines |
| **Ops / internal** | Reports, notifications, mailers, school data |
| **AI / MCP-assisted** | RAG demos, WhatsApp+LLM, sentiment bots |

## Execution model

| Model | Meaning |
|-------|---------|
| **On-demand** | Paperclip assigns a task; integration agent or bridge fires the workflow |
| **Event-driven** | External systems call webhooks; Paperclip may only monitor or escalate |
| **Scheduled** | n8n cron; Paperclip may own verification tasks (executions API) |
| **Mixed** | Multiple trigger types |

## Inventory (exported 2026-03-21)

_Suggested `lane` / `execution_model` are starting points — adjust in Paperclip governance._

| workflow_id | name | active | inferred_trigger | lane | execution_model | inputs_required | outputs | paperclip_notes |
|-------------|------|--------|------------------|------|-----------------|-----------------|---------|-----------------|
| 0Mwe1RC5d73VtyTS | LearnXR - Website Lead Intake v2 | false | Webhook | Inbound / growth | event-driven | Lead JSON + `correlationId` | CRM / notifications | Activate when cutting over from v1; bridge key `learnxr-website-lead` if path matches |
| 1dbduBYAtiOmiiNc | NOT tHIS ONE | false | other | — | — | — | — | Candidate to archive in n8n |
| 3fOkF1NqSTjBNPYI | Demo: RAG in n8n | false | Form | AI / MCP-assisted | on-demand | Form fields | RAG output | Demo / lab |
| 8016ziIiTuncugmx | PDF TO VR LESSON | false | Webhook, Schedule | Content / LMS | mixed | PDF / metadata | Lesson assets | Webhook path must match n8n node; add bridge key after path known |
| 9A6giGXIHjFIoxSx | My workflow 3 | false | Form | — | on-demand | — | — | Rename or assign owner in n8n |
| CIl23CUPd8TOKJ8C | Email sender and verifier | false | Manual | Ops / internal | on-demand | Email payload | Send result | Manual / sub-workflow |
| Cpz14ZdtOOzAQvL9 | Copied UI interface pdf to vr lesson | false | Webhook | Content / LMS | on-demand | Per webhook contract | — | Duplicate of UI lesson flow; consolidate |
| Ec0AyzI3UQ0Ah1F0 | reply detection | false | Manual | Ops / internal | on-demand | — | — | |
| ElTX1Nzu2vkS9N38 | ✨🤖Automate Multi-Platform Social Media Content Creation with AI | false | Form | Inbound / growth | on-demand | Form / content inputs | Social posts | |
| FBF5c7bnrOgpToiN | My workflow 2 | false | Webhook | — | on-demand | — | — | Rename or assign owner |
| LjnY0nmY8hNTDY6p | LearnXR - Website Lead Intake | false | Webhook | Inbound / growth | event-driven | Lead JSON + `correlationId` | CRM | Legacy lead flow; `learnxr-website-lead` if path matches |
| M2JtKrQffsQnNOYR | UI INTERFACE PDF TO VR LESSON | true | Webhook | Content / LMS | on-demand | PDF / lesson params | VR lesson pipeline | **Active**; bridge key `ui-pdf-to-vr-lesson` → path `b8608c3e` (n8nUI `.env`) |
| NOOQPSvF8oXHkqxU | My workflow | false | Webhook | — | on-demand | — | — | Rename or assign owner |
| Yc4aMmnkQyfs1NN0 | School data fetching | false | Manual | Ops / internal | on-demand | Query params | Data export | |
| YsYQLl9bJxe3c1w2 | Personal_Assistant | false | Schedule | Ops / internal | scheduled | — | Notifications | Paperclip verification tasks optional |
| bJQC23r5at0P8qdA | Data Scrap + Email + Whatsapp Sales Funnel | true | Webhook, Schedule, Manual | Inbound / growth | mixed | Scrape targets / leads | Email, WhatsApp | **Active**; strict allowlist before bridge |
| bNA6y0XuqzB9hksy | 1 week reminder mailer | false | Schedule | Ops / internal | scheduled | — | Email | |
| l0OonwBFn6Gwx2FM | AI WhatsApp support with human handoff (Gemini, Twilio, Supabase RAG 2) | true | other | AI / MCP-assisted | event-driven | WhatsApp payloads | Handoff / replies | **Active**; verify trigger nodes in n8n UI |
| lH0g9rulfO8o1FNQ | Fetcher, verifier mailer and reply detecter | false | Schedule, Manual | Ops / internal | mixed | — | Email | |
| lp1UhrjHy5cZCnHo | My workflow 4 | false | other | — | — | — | — | Rename or assign owner |
| p9urLB4E4dnBlvWf | Sentiment reply of whatsapp Message | false | other | AI / MCP-assisted | event-driven | Message | Reply | |
| xMZyNcduxBf3qTqA | VR/AR Education News to Social Media | false | Form | Inbound / growth | on-demand | News / form input | Social | |

## Inferred triggers (from export)

The export script inspects `nodes[].type` for common n8n trigger types. Verify in the n8n UI before relying on this for governance.
