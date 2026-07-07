@echo off
setlocal enabledelayedexpansion

echo.
echo  =========================================
echo   RADAR - Real-time Autonomous Defense
echo         And Response
echo  =========================================
echo  Starting RADAR...
echo.

REM ─── Check .venv exists ───────────────────────────────────────────────────────
if not exist .venv\Scripts\python.exe (
    echo  ERROR: Virtual environment not found.
    echo  Please run setup.bat first!
    echo.
    pause
    exit /b 1
)

REM ─── Check backend/dist exists ───────────────────────────────────────────────
if not exist backend\dist\index.html (
    echo  [INFO] Frontend not built yet. Building now...
    cd frontend
    call npm run build
    cd ..
    if exist backend\dist rmdir /s /q backend\dist
    xcopy /e /i /q frontend\dist backend\dist
    echo  [OK] Frontend built.
)

REM ─── Check .env exists ───────────────────────────────────────────────────────
if not exist .env (
    copy .env.example .env >nul
    echo  [INFO] Created .env from .env.example (demo mode - no AI keys).
)

echo  [OK] All checks passed.
echo.
echo  ============================================================
echo   RADAR is starting at: http://localhost:54321
echo  ============================================================
echo.
echo   API Docs:   http://localhost:54321/api/docs
echo   Dashboard:  http://localhost:54321
echo.
echo   To stop RADAR, press Ctrl+C in this window.
echo.

REM ─── Start backend (serves frontend + API from single port) ──────────────────
.venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 54321 --reload
