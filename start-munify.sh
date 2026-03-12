#!/bin/bash
echo "====================================================="
echo "   Iniciando Módulos de MUNify (WSL/Linux)"
echo "====================================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIN_PROJECT_DIR=$(wslpath -w "$PROJECT_DIR")

echo "[0/4] Limpiando procesos antiguos en puertos..."
for port in 8080 8000 3001 1234; do
    pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        kill -9 $pid 2>/dev/null
        echo "  Killed process on port $port"
    fi
done
echo ""

# 1. Spring Boot Backend
echo "[1/4] Iniciando Core Backend (Spring Boot)..."
WSL_IP=$(hostname -I | awk '{print $1}')
export SPRING_DATASOURCE_URL="jdbc:postgresql://${WSL_IP}:5432/munify_db"
cd "$PROJECT_DIR/apps/core-backend"
./mvnw spring-boot:run &> /tmp/munify_backend.log &
BACKEND_PID=$!
echo "  PID: $BACKEND_PID (log: /tmp/munify_backend.log)"

# 2. AI Agents (Python)
echo "[2/4] Iniciando Agentes de IA (Python/FastAPI)..."
cd "$PROJECT_DIR/apps/ai-agents"
if [ -d "venv" ]; then
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
fi
python api.py &> /tmp/munify_ai.log &
AI_PID=$!
echo "  PID: $AI_PID (log: /tmp/munify_ai.log)"

# 3. Collaboration Server
echo "[3/4] Iniciando Collaboration Server (Yjs WebSocket)..."
cd "$PROJECT_DIR/apps/collaboration-server"
npm start &> /tmp/munify_collab.log &
COLLAB_PID=$!
echo "  PID: $COLLAB_PID (log: /tmp/munify_collab.log)"

# 4. Next.js Frontend
echo "[4/4] Iniciando Frontend (Next.js)..."
cd "$PROJECT_DIR/apps/web-ui"
npm run dev &> /tmp/munify_frontend.log &
FRONTEND_PID=$!
echo "  PID: $FRONTEND_PID (log: /tmp/munify_frontend.log)"

echo ""
echo "====================================================="
echo "   Todos los servicios han sido lanzados."
echo "   - Backend (Spring Boot):  http://localhost:8080"
echo "   - AI Agents (FastAPI):    http://localhost:8000"
echo "   - Collab Server (Yjs):    ws://localhost:1234"
echo "   - Frontend (Next.js):     http://localhost:3001"
echo ""
echo "   Para ver logs: tail -f /tmp/munify_*.log"
echo "   Para parar todo: kill $BACKEND_PID $AI_PID $COLLAB_PID $FRONTEND_PID"
echo "====================================================="
echo ""
echo "Presiona Ctrl+C para detener todos los servicios..."

# Trap Ctrl+C to kill all processes
trap "echo ''; echo 'Deteniendo servicios...'; kill $BACKEND_PID $AI_PID $COLLAB_PID $FRONTEND_PID 2>/dev/null; echo 'Listo.'; exit 0" SIGINT

# Wait for all
wait
