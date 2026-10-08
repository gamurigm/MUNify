@echo off
echo =====================================================
echo    MUNify v3 — Starting Services
echo =====================================================
echo.

set PROJECT_DIR=%~dp0

echo [0/3] Cleaning old processes on ports...
for %%p in (8080 8000 3001) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo.

:: ─── 1. Go Gateway (Auth + Sessions + Documents + WebSocket + AI Proxy) ───
echo [1/3] Starting Gateway (Go)...
start "MUNify - Gateway" cmd /c "cd /d %PROJECT_DIR%gateway && title MUNify Gateway && echo Starting MUNify Gateway... && munify-gateway.exe || pause"

:: ─── 2. AI Engine (Python/FastAPI — only AI endpoints) ───
echo [2/3] Starting AI Engine (Python/FastAPI)...
start "MUNify - AI Engine" cmd /c "cd /d %PROJECT_DIR%apps\ai-agents && title MUNify AI Engine && echo Starting AI Engine... && call venv\Scripts\activate.bat && python api.py || pause"

:: ─── 3. Frontend (Next.js) ───
echo [3/3] Starting Frontend (Next.js)...
start "MUNify - Frontend" cmd /c "cd /d %PROJECT_DIR%apps\web-ui && title MUNify Frontend && echo Starting Next.js... && npm run dev || pause"

echo.
echo =====================================================
echo    All services launched (3 processes vs 4 before).
echo    - Gateway (Go):        http://localhost:8080
echo    - AI Engine (FastAPI):  http://localhost:8000
echo    - Frontend (Next.js):  http://localhost:3001
echo    - WebSocket (Collab):  ws://localhost:8080/ws/collab/
echo =====================================================
echo.
pause
