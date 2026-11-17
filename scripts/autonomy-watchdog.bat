@echo off
REM EN TV Player autonomy watchdog — runs every 10 minutes, 13:30-19:30 Dhaka.
REM The script itself checks the window, active sessions, queue and task state.
cd /d "C:\Users\EftynurPc\Documents\02_Work\Dev_Projects\en-tvplayer"
node scripts\autonomy-watchdog.mjs >> "%TEMP%\en-tvplayer-autonomy.log" 2>&1
