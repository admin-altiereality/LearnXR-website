# Paperclip org map: Altie Reality Private Limited

Align **Paperclip** structure with n8n **capability lanes** so every lane has an owner—not one Paperclip agent per n8n node.

## Company

- **Paperclip company:** Altie Reality Private Limited (already created locally).

## Suggested projects (mirror lanes)

| Project | Owns |
|---------|------|
| **Growth** | Inbound / growth n8n workflows, lead routing, campaigns |
| **Content** | LMS / lesson / asset automation |
| **Platform** | Infra, integrations, shared services |
| **Ops** | Internal reports, notifications, CRM sync |

Adjust names to match how you already use Paperclip.

## Agent types

| Type | Runtime (Paperclip) | Responsibility |
|------|---------------------|----------------|
| **LLM / coding** | Cursor, Claude Code, OpenClaw, etc. | Strategy, code, review, incident diagnosis |
| **Integration** | HTTP or Bash agent | Only call **allowlisted** n8n endpoints (direct webhook or LearnXR bridge) |

## Integration agents (suggested roster)

One integration agent **per lane** (or per environment if you split prod/staging):

| Agent id (example) | Lane | Allowlist source |
|--------------------|------|------------------|
| `integrations-growth` | Growth | [ASSIGNMENT_MATRIX.md](./ASSIGNMENT_MATRIX.md) Growth rows + bridge keys |
| `integrations-content` | Content | Content rows |
| `integrations-platform` | Platform | Platform rows |
| `integrations-ops` | Ops | Ops rows |

**Rule:** Do not give integration agents arbitrary URLs—only paths/keys defined in the assignment matrix and `paperclip-n8n-workflows.json`.

## Governance

- New workflows or webhook paths require an explicit update to the assignment matrix and workflow map before integration agents may call them.
- LLM agents should not hold production n8n API keys; use the bridge with `PAPERCLIP_BRIDGE_SECRET` scoped to integration agents only.
