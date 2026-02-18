# HexStrike.ai MCP Setup (Phase 1)

HexStrike is cloned to **D:\hexstrike-ai**. Complete the following steps when Python 3 is available on your system.

## 0. If Python is not installed or `py` / `python` fails

Your `py` launcher is pointing to a missing Python (`C:\Python313\python.exe`). Do one of the following:

**Option A – Install from python.org (recommended)**  
1. Go to [https://www.python.org/downloads/](https://www.python.org/downloads/) and download **Python 3.11 or 3.12** (Windows installer).  
2. Run the installer.  
3. **Check “Add python.exe to PATH”** at the bottom, then click “Install Now”.  
4. Close and reopen your terminal (or Cursor).  
5. Confirm: `python --version` or `py -3 --version` should show the version.

**Option B – Install from Microsoft Store**  
1. Open Microsoft Store, search for **Python 3.12** (or 3.11), install it.  
2. Close and reopen your terminal.  
3. Confirm: `python3 --version` or `python --version`.

After Python is installed, use the same terminal and run the commands in section 1 below. If you used the Store and only `python3` works, use `python3` instead of `python` in the rest of this guide.

## 1. Create virtual environment

```powershell
cd D:\hexstrike-ai
python -m venv hexstrike-env
```
If `python` is not found, try `py -3 -m venv hexstrike-env` or `python3 -m venv hexstrike-env` (depending on how you installed Python).

## 2. Activate and install dependencies

```powershell
D:\hexstrike-ai\hexstrike-env\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 3. (Optional) Install security tools

For web/API testing you may install e.g. nuclei, nikto, httpx via Chocolatey, Scoop, or official installers. Document which tools you use in the security report.

## 4. Start HexStrike server

```powershell
# From D:\hexstrike-ai with venv activated
python hexstrike_server.py
```

Default: port **8888**, localhost only. Verify: `curl http://localhost:8888/health` or open in browser.

## 5. Use with Cursor

Cursor MCP is already configured to use HexStrike when the server is running. Restart Cursor after the server is up. Use Composer/Agent and target **http://localhost:5002** (and optionally **http://localhost:5173**) only—never production.

## Troubleshooting (Windows)

- **`FileNotFoundError: \\tmp\\hexstrike_envs`** or **`UnicodeEncodeError` for emoji in logs**: These are fixed in a patched `hexstrike_server.py` that uses the system temp directory and UTF-8 console output. If you pulled a fresh clone, re-apply the same fixes (temp dir for `hexstrike_envs` / `hexstrike_files`, UTF-8 for stdout/stderr) or use the modified copy under `D:\hexstrike-ai` from this setup.

## Security note

- Check the [HexStrike repo](https://github.com/0x4m4/hexstrike-ai) for fixes for CVE-2025-35028 before use.
- Do not expose the HexStrike server to the network; keep it bound to localhost.
