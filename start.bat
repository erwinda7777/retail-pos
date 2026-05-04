@echo off
setlocal
cd /d "%~dp0"

echo Starting Retail POS...
echo.
docker compose up --build -d

if errorlevel 1 (
  echo.
  echo Could not start the app. Make sure Docker Desktop is installed and running.
  pause
  exit /b 1
)

echo.
echo Retail POS is starting.
echo Frontend: http://localhost
echo Backend:  http://localhost:4000
echo.
echo Login:
echo   admin@example.com
echo   123456
echo.

timeout /t 8 /nobreak >nul
start http://localhost
pause
