@echo off
title OpenClaw - set OPENAI_API_KEY
cd /d "%~dp0"
echo Running in PowerShell (this window). Paste your key when asked; input stays hidden.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prompt-openai-key.ps1"
echo.
pause
