@echo off
title Cicero Online
cd /d "%~dp0"

if not exist ".venv" (
  echo First time setup: creating Python environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

if not exist "node_modules" (
  echo First time setup: installing website packages...
  call npm install
)

echo.
echo  Cicero Online is starting...  Open http://localhost:3000 in your browser.
echo  Keep this window open. Close it to stop the app.
echo.
start "" http://localhost:3000
call npm run dev
