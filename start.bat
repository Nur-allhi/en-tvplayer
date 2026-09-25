@echo off
setlocal enabledelayedexpansion
title EN TV Player (Desktop Test)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5001 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo  Starting EN TV Player (desktop testing)...
echo.
echo  Player:  http://localhost:5173/enplayer/
echo  Proxy:   https://localhost:5001
echo.
echo  Prefix channel URLs with the proxy URL to test DRM channels.
echo  Note: Accept the proxy self-signed warning once (Advanced ^> Proceed).
echo.

start "EN Proxy" cmd /c node proxy\proxy.mjs
start "EN Player" cmd /c npm run dev

echo  Both started in separate windows.
pause
