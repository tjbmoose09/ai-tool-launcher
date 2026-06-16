@echo off
setlocal
set APP_DIR=%~dp0..
if "%AI_TOOL_LAUNCHER_PORT%"=="" set AI_TOOL_LAUNCHER_PORT=47623
set URL=http://127.0.0.1:%AI_TOOL_LAUNCHER_PORT%
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  exit /b 1
)
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%/api/health' | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "AI Tool Launcher Server" /min node "%APP_DIR%\server.js"
  timeout /t 2 /nobreak >nul
)
start "" "%URL%"
