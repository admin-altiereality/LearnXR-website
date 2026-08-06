# Partner notification setup

Partner notifications are delivered through n8n webhooks. Configure an email node in each n8n workflow, then set these environment variables for the Firebase `api` function:

| Event | Environment variable | Webhook payload |
| --- | --- | --- |
| Application submitted | `N8N_PARTNER_WEBHOOK_URL` or `N8N_API_URL` | `type: "partner_application_received"` |
| Application approved | `N8N_PARTNER_APPROVE_WEBHOOK_URL` | `type: "partner_approved"` |

The registration webhook can alternatively be derived from `N8N_API_URL` and `N8N_PARTNER_WEBHOOK_PATH`, which defaults to `learnxr-website-partner`.

Both payloads include `notification.recipient` with the partner email address. The approval payload includes:

| Field | Purpose |
| --- | --- |
| `contactName` | Partner contact name |
| `organizationName` | Partner organization |
| `email` / `username` | Sign-in email (username) |
| `inviteLink` / `passwordSetupLink` | Firebase password-setup URL |

In n8n, the email HTML field must be an **expression** (leading `=`), e.g. `={{ $json.body.contactName }}` inside an `=<p>...</p>` body. Plain-text `{{ ... }}` is sent literally.

Set `APP_ORIGIN` or `CLIENT_ORIGIN` to the hosted LearnXR URL so the password-setup link continues to `/partner-login`.
