# Paperclip CEO agent + LearnXR n8n bridge

## What you are seeing in Paperclip (CEO agent)

Lines like:

```text
[paperclip] Injected Cursor skill "paperclipai/paperclip/paperclip" into C:\Users\home\.cursor\skills
```

are **not errors**. Paperclip’s Cursor adapter copies (or repairs) bundled skills into `~/.cursor/skills` so the Cursor CLI can load them. In Paperclip builds **before** the adapter fix, those messages were written to **stderr**, so the UI showed them as STDERR. They are normal startup noise.

**“No transcript captured”** on an old run means Paperclip did not persist a transcript for that execution (e.g. run interrupted, adapter exited before flush, or a bug). It is unrelated to skill injection. Re-run the CEO agent after the stack is stable.

### `Command not found in PATH: "agent"` (CEO / cursor adapter)

Paperclip runs the **Cursor Agent CLI** as the `agent` command. That is **not** the same as the `cursor` shortcut in the editor install.

- **Windows:** In PowerShell run: `irm 'https://cursor.com/install?win32=true' | iex` — this installs to `%LOCALAPPDATA%\cursor-agent` and adds it to your **user** PATH. Restart Paperclip after installing so the server sees the updated PATH.
- Recent Paperclip builds also prepend `%LOCALAPPDATA%\cursor-agent` when resolving the default `agent` command, so runs can work even if the server was started before PATH was updated (once the CLI is installed).

Verify: `agent --version` in a new terminal.

### `Authentication required` / `agent login` / `CURSOR_API_KEY`

The Cursor Agent CLI must be logged in or given an API key. Paperclip does not use your Cursor editor session by itself.

**Option A — Browser login (good for personal use)**  
In PowerShell (ensure `agent` is on PATH, e.g. `%LOCALAPPDATA%\cursor-agent` first):

```powershell
agent login
```

Finish sign-in in the browser, then **restart Paperclip** so new runs pick up stored credentials.

**Option B — API key (good for automation)**  
1. Create a key at [Cursor — Settings / API Keys](https://cursor.com/settings).  
2. Add to your Paperclip instance `.env` (next to `config.json`, e.g. `C:\Users\<you>\.paperclip\instances\<instance>\.env`):

```env
CURSOR_API_KEY=your_key_here
```

3. Restart Paperclip.

Alternatively, in the Paperclip UI you can set `CURSOR_API_KEY` under the CEO agent’s **cursor** adapter **env** (or use a company secret reference if you use strict secret mode).

### `PAPERCLIP_API_KEY` missing during runs (heartbeat / `/api/agents/me` 401)

`PAPERCLIP_API_KEY` in an adapter run is a **short-lived JWT** minted by Paperclip, not the Cursor API key. The server can only mint it if **`PAPERCLIP_AGENT_JWT_SECRET`** is set (same folder as `config.json`, usually `~/.paperclip/instances/<instance>/.env`).

- If the startup banner shows **Agent JWT: missing**, add a long random secret, e.g. run `pnpm paperclipai onboard` per Paperclip docs, or set `PAPERCLIP_AGENT_JWT_SECRET` yourself and **restart Paperclip**.
- When JWT is **set**, each cursor (and other local) run gets `PAPERCLIP_API_KEY` in the process environment so the CEO can call the Paperclip API with `Authorization: Bearer …`.

## Bridge URL (LearnXR server)

With the default dev layout:

- **LearnXR API (bridge):** `http://127.0.0.1:5002`
- **Trigger path:** `POST /api/paperclip-n8n/trigger`
- **Auth:** `Authorization: Bearer <PAPERCLIP_BRIDGE_SECRET>` (same value as `server/.env` on LearnXR)

Workflow keys and payloads are defined in `server/config/paperclip-n8n-workflows.json`.

## Optional: CEO agent instructions (paste into Paperclip)

Use this as the CEO agent’s **instructions** (or system prompt) so it knows how to delegate to n8n via LearnXR:

```markdown
## n8n automation (LearnXR bridge)

When a task should run in n8n (workflows, webhooks, scheduled automation), call the LearnXR bridge:

- **URL:** `http://127.0.0.1:5002/api/paperclip-n8n/trigger` (adjust host/port if LearnXR runs elsewhere).
- **Method:** POST
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <secret>` (use the org’s Paperclip bridge secret; do not commit it).
- **Body:** `{ "workflowKey": "<key from paperclip-n8n-workflows.json>", "correlationId": "<unique id>", "payload": { ... } }`

Always pass a **correlationId** (e.g. `ceo-{timestamp}` or UUID) for tracing across logs and n8n.

If the bridge returns 401, the secret is wrong or missing. If connection fails, LearnXR may not be running on the expected port.
```

Store the bearer secret in Paperclip’s **Secrets** for the CEO agent (or org), not in committed files.

## Paperclip + LearnXR ports (reference)

| Service        | Typical port |
|----------------|--------------|
| LearnXR API    | 5002         |
| Paperclip API  | 3100         |
| Paperclip UI   | 5173         |

Ensure only **one** Paperclip server process uses the same data directory so the embedded DB is not locked by a duplicate instance.
