# 📖 MUNify: Instrucciones Generales y Arquitectura

Este archivo contiene las directrices fundamentales para el desarrollo de MUNify. **Debes leer este archivo al inicio de cada sesión para mantener el contexto.**

## 🚀 Stack Tecnológico Principal

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS v4.
- **Backend Core:** Spring Boot 3.4 (Java 21) + Spring Security (OAuth2/JWT) + PostgreSQL.
- **AI Engine:** Python 3.12 + LangGraph + FastAPI + Tavily + NVIDIA NIM.
- **Observabilidad:** Logfire (Python) + Grafana (Dashboard general).
- **Entorno Python:** Todos los scripts de Python deben ejecutarse dentro del `venv` ubicado en `apps/ai-agents/venv`.

## 📂 Estructura del Proyecto (Monorepo)

- `apps/web-ui`: Aplicación Next.js (Puerto 3001).
- `apps/core-backend`: API REST en Spring Boot (Puerto 8080).
- `apps/ai-agents`: Microservicio de agentes de IA en Python (Puerto 8000).
- `grafana`: Configuración de monitoreo.

## 🔑 Credenciales y Configuración

- Los secretos se manejan exclusivamente mediante archivos `.env` en cada sub-app.
- **Logfire Project:** `munify/logfire`
- **Frontend URL:** `http://localhost:3001`
- **Backend URL:** `http://localhost:8080`
- **AI Agent URL:** `http://localhost:8000`

## 🎨 Identidad Visual (Diplomática Premium)

- **Fondo:** `#040d21` (Navy Deep Space).
- **Acentos:** `#00f5ff` (Electric Cyan) y `#c44dff` (Neon Purple).
- **Estilo:** Glassmorphism, tipografía Inter, animaciones sutiles.

## 🛠️ Reglas de Desarrollo

1. **Python en Venv:** Siempre usa el `venv` para comandos de Python (ej: `.\venv\Scripts\python main.py`).
2. **Observabilidad:** Todas las funciones críticas del AI Engine deben estar instrumentadas con `@logfire.instrument`.
3. **Atomicidad:** Realiza cambios pequeños y verificables.
4. **Clean Code:** Sigue principios SOLID y Clean Architecture en Java/Python.

LEER `TAREAS.md`