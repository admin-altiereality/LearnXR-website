# Testing LearnXR with HexStrike.ai

HexStrike.ai is an AI-powered security testing (MCP) platform. This project is configured to use it from Cursor.

## Prerequisites

- **HexStrike.ai** installed at: `C:\Users\home\Desktop\hexstike.ai\hexstrike-ai`
- **HexStrike server** must be running at `http://127.0.0.1:8888` for the MCP to work.

## 1. Start the HexStrike server

From PowerShell (run once per session):

```powershell
cd C:\Users\home\Desktop\hexstike.ai\hexstrike-ai
.\run-server.ps1
```

Or:

```powershell
cd C:\Users\home\Desktop\hexstike.ai\hexstrike-ai
$env:PYTHONUTF8 = "1"
.\hexstrike-env\Scripts\python.exe hexstrike_server.py
```

Leave this window open. You should see: `Running on http://127.0.0.1:8888`.

## 2. Use HexStrike in Cursor

- This repo's **`.cursor/mcp.json`** already includes the **hexstrike-ai** MCP server.
- **Restart Cursor** (or reload the window) so it picks up the MCP and connects to the HexStrike server.
- In the chat, you can ask to run security checks against your app using the HexStrike tools (e.g. "Run a quick security scan on our LearnXR app" and provide the URL).

## 3. URLs to test

- **Local dev:** `http://localhost:5173` (or whatever port your Vite dev server uses)
- **Firebase testing channel:** e.g. `https://altiereality--testing-XXXXX.web.app` (from `firebase hosting:channel:deploy testing`)

## 4. Verify setup

- **Server health:** Open in browser or run:  
  `Invoke-RestMethod -Uri "http://127.0.0.1:8888/health" -Method Get`
- **Cursor:** After restart, the HexStrike MCP tools should appear when the AI uses them for security tasks.

## 5. Installing external tools (thorough web scans)

To run **nmap**, **gobuster**, **nuclei**, and **sqlmap** on Windows:

1. Run the install script from the LearnXR-website folder:
   ```powershell
   .\scripts\Install-HexStrike-Tools.ps1
   ```
   This installs Nmap (winget), downloads Gobuster and Nuclei to `C:\Users\home\Desktop\hexstike.ai\hexstrike-tools`, installs SQLMap in the HexStrike venv, creates a wordlist, and adds the tools directory to your user PATH.

2. Restart PowerShell so PATH updates.

3. Update Nuclei templates once:  
   `C:\Users\home\Desktop\hexstike.ai\hexstrike-tools\nuclei.exe -update-templates`

4. Restart the HexStrike server, then re-run your app test or smart-scan.

**Nikto** is optional (requires Perl on Windows); the script skips it. The HexStrike server is patched to use Windows `where` for tool detection and the script's wordlist for Gobuster on Windows.
