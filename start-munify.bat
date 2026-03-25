@echo off
echo =====================================================
echo    Iniciando Módulos de MUNify (Windows)
echo =====================================================
echo.

:: Ya no se requiere Docker para desarrollo local (usando H2 embebida)
echo [INFO] Usando base de datos H2 embebida (sin Docker requerido).
echo.

echo [0/4] Limpiando procesos antiguos en puertos...
for %%p in (8080 8000 3001 1234) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo.

set PROJECT_DIR=%~dp0
set "JAVA_HOME=C:\Program Files\RedHat\java-21-openjdk-21.0.10.0.7-1"
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: Iniciar Spring Boot Core Backend en una nueva ventana
echo [1/4] Iniciando Core Backend (Spring Boot + H2)...
start "MUNify - Core Backend" cmd /c "cd /d %PROJECT_DIR%apps\core-backend && title MUNify Core Backend && echo Iniciando Spring Boot con H2... && mvnw spring-boot:run || pause"

:: Iniciar AI Agents (Python FastAPI) en una nueva ventana
echo [2/4] Iniciando Agentes de IA (Python/FastAPI)...
start "MUNify - AI Agents" cmd /c "cd /d %PROJECT_DIR%apps\ai-agents && title MUNify AI Agents && echo Iniciando entorno virtual y FastAPI... && call venv\Scripts\activate.bat && python api.py || pause"

:: Iniciar Servidor de Edición Colaborativa (Yjs/WebSocket) en una nueva ventana
echo [3/4] Iniciando Collaboration Server (Yjs WebSocket)...
start "MUNify - Collab Server" cmd /c "cd /d %PROJECT_DIR%apps\collaboration-server && title MUNify Collab Server && echo Iniciando Y-Websocket Server en puerto 1234... && npm start || pause"

:: Iniciar Next.js Frontend en una nueva ventana
echo [4/4] Iniciando Frontend (Next.js)...
start "MUNify - Web UI" cmd /c "cd /d %PROJECT_DIR%apps\web-ui && title MUNify Web UI && echo Iniciando Next.js... && npm run dev || pause"

echo.
echo =====================================================
echo    Todos los servicios han sido lanzados.
echo    - Backend (Spring Boot):  http://localhost:8080
echo    - H2 Console:             http://localhost:8080/h2-console
echo    - AI Agents (FastAPI):    http://localhost:8000
echo    - Collab Server (Yjs):    ws://localhost:1234
echo    - Frontend (Next.js):     http://localhost:3001
echo =====================================================
echo.
pause
