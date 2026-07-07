@echo off
setlocal enabledelayedexpansion

echo.
echo  =========================================
echo   RADAR - Real-time Autonomous Defense
echo         And Response
echo  =========================================
echo  FIRST-TIME SETUP  ^|  Windows
echo.

REM ─── Check Python ─────────────────────────────────────────────────────────────
echo [1/6] Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Python is not installed or not in PATH.
    echo  Download Python 3.10+ from: https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo  [OK] Python %PY_VER% found.

REM ─── Check Node.js ────────────────────────────────────────────────────────────
echo [2/6] Checking Node.js version...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Download Node.js 18+ from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f %%v in ('node --version 2^>^&1') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% found.

REM ─── Create Python virtual environment ───────────────────────────────────────
echo [3/6] Creating Python virtual environment (.venv)...
if exist .venv (
    echo  [SKIP] .venv already exists.
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo  ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo  [OK] Virtual environment created.
)

REM ─── Install Python dependencies ─────────────────────────────────────────────
echo [4/6] Installing Python dependencies...
call .venv\Scripts\pip install -r backend\requirements.txt --quiet
if errorlevel 1 (
    echo  ERROR: Failed to install Python dependencies.
    pause
    exit /b 1
)
echo  [OK] Python dependencies installed.

REM ─── Install Node.js dependencies ────────────────────────────────────────────
echo [5/6] Installing frontend dependencies (npm install)...
cd frontend
call npm install --silent
if errorlevel 1 (
    echo  ERROR: Failed to install Node.js dependencies.
    cd ..
    pause
    exit /b 1
)
cd ..
echo  [OK] Frontend dependencies installed.

REM ─── Build frontend ───────────────────────────────────────────────────────────
echo [6/6] Building React frontend into backend/dist ...
cd frontend
call npm run build
if errorlevel 1 (
    echo  ERROR: Frontend build failed.
    cd ..
    pause
    exit /b 1
)
cd ..

REM Copy dist to backend/dist so FastAPI can serve it
if exist backend\dist (
    rmdir /s /q backend\dist
)
xcopy /e /i /q frontend\dist backend\dist
echo  [OK] Frontend built and copied to backend\dist

REM ─── Setup .env ───────────────────────────────────────────────────────────────
if not exist .env (
    copy .env.example .env >nul
    echo.
    echo  [INFO] Created .env from .env.example
    echo  [INFO] The app works in demo mode without API keys.
    echo  [INFO] To enable AI features, open .env and add your GEMINI_API_KEY.
)

echo.
echo  ============================================================
echo   Setup complete!
echo  ============================================================
echo.
echo   To start RADAR, run:
echo     start.bat
echo.
echo   Then open your browser at:
echo     http://localhost:54321
echo.
echo   To simulate attacks (in another terminal):
echo     python attack_tools/run_nmap_scan.py --target ^<TARGET_IP^>
echo     python attack_tools/run_ssh_brute.py --target ^<TARGET_IP^>
echo.
pause
