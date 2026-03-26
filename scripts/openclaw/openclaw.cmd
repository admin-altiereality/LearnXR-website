@echo off
REM Proxy for OpenClaw CLI with Node >= 22.16 (see openclaw.ps1).
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openclaw.ps1" %*
exit /b %ERRORLEVEL%
