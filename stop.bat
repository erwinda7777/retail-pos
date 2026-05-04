@echo off
setlocal
cd /d "%~dp0"

echo Stopping Retail POS...
docker compose down
pause
