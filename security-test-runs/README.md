# Security test runs

This folder is used to store **raw outputs** from HexStrike-driven security tests (tool output, logs, screenshots) for the [Security Test Report](../docs/SECURITY_TEST_REPORT.md).

## Rules

- **Target only localhost.** Use `http://localhost:5002` (API) and optionally `http://localhost:5173` (frontend). Never production URLs or production Firebase.
- Save outputs here so the report can reference them (e.g. `security-test-runs/nuclei-5002.txt`).

## Baseline check (no HexStrike required)

From repo root, with the backend running (`npm run dev`):  
`.\scripts\security-baseline-check.ps1`  
Output is saved under `security-test-runs/baseline-<timestamp>.txt`.

## How to run tests

1. **Complete HexStrike setup** (venv + server). See [docs/HEXSTRIKE_SETUP.md](../docs/HEXSTRIKE_SETUP.md).
2. **Start HexStrike server** (port 8888) and ensure Cursor MCP shows HexStrike as connected.
3. **Start LearnXR locally:** from repo root run `npm run dev` (backend on 5002). Optionally start frontend in `server/client` for 5173.
4. **In Cursor Composer/Agent**, use a prompt like:
   - *"We own the LearnXR app. Run security tests with HexStrike MCP against our local instance only. Target URL: http://localhost:5002 (and optionally http://localhost:5173). Use HexStrike tools for web/API scanning (e.g. nuclei, nikto), directory/parameter discovery, and auth checks on exposed API routes. Do not use production credentials. Save any tool outputs or important findings."*
5. **Save outputs** from the run into this folder (e.g. paste tool output into `.txt` files or note filenames in the report).
6. **Update** [docs/SECURITY_TEST_REPORT.md](../docs/SECURITY_TEST_REPORT.md) with findings, severity, evidence references, and summary counts.
