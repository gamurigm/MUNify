# 🌐 MUNify: Plan Maestro Detallado (IA + Arquitectura Distribuida 2026)

Este documento representa la versión exhaustiva del plan de ejecución para **MUNify**, integrando todas las especificaciones técnicas de la arquitectura distribuida, el flow de agentes de IA y la estrategia de despliegue en entornos gratuitos.

---

## 1. Identidad y Propuesta de Valor
**Nombre Sugerido:** **MUNify** (o Consensus, Diplomata, Resolvo).
**Propósito:** Plataforma integral para Simulaciones MUN que utiliza agentes de IA (NVIDIA NIM, Tavily, NotebookLM) para investigación, redacción colaborativa y validación diplomática basada en estándares ONU reales.

---

## 2. Stack Tecnológico de Vanguardia (2026)

| Componente | Tecnología | Detalle de Implementación |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 15 + React 19** | App Router, Server Actions, Server Components, Concurrent Mode. |
| **Backend Core** | **Spring Boot 3.4+** | Java 21, Clean Architecture, SOLID, Spring Security (JWT), WebSocket (STOMP/SockJS). |
| **AI Orchestrator** | **LangGraph (Python)** | Orquestación de grafos cíclicos para agentes, multi-paso. |
| **Capa de Datos** | **PostgreSQL (Supabase/Neon), Redis (Upstash), Consul** | **Pgvector (768 dim)** para búsqueda semántica local de tratados. Redis para WebSockets (Socket.IO), colas de oradores y caché de IA. Consul para descubrimiento de servicios en entornos distribuidos. |
| **Observabilidad & Monitoreo** | **Prometheus, Grafana** | Prometheus para recolección de métricas de Spring Boot, FastAPI y uso de tokens de IA. Grafana para visualización de dashboards para performance, errores de agentes y salud del sistema. |
| **Colaboración** | **Yjs + TipTap** | CRDTs para edición sin conflictos en tiempo real. |
| **Visualización** | **Tremor, React-simple-maps, TanStack Table** | Tremor (charts), Simple-maps (geopolítica), TanStack (tablas). |

---

## 3. Arquitectura Distribuida Híbrida

La aplicación opera bajo un modelo distribuido para maximizar el uso de recursos gratuitos y asegurar escalabilidad:

### A. Capas de Comunicación
1.  **Frontend (Vercel/Cloudflare Pages):** Cliente React 19 que consume el BFF (Backend-for-Frontend) de Next.js.
2.  **API Gateway (Traefik/Hono):** Enrutamiento inteligente. En local, orquestado por **Consul** para service discovery.
3.  **Service Mesh:** Comunicación interna mediante gRPC o REST entre Spring Boot y FastAPI.

### B. Flujo de Datos Real-Time
- **WebSockets:** Implementados vía **Socket.io** con adaptador Redis para escalar horizontalmente.
- **Sincronización de Documentos:** Servidor dedicado de **Y-Websocket** para manejar los updates de CRDT.

---

## 4. Orquestación de IA: El Grafo "Consejero Diplomático"

Usaremos **LangGraph** para definir nodos especializados que interactúan entre sí:

### Nodos del Grafo (Roles)
1.  **🔍 Agente Investigador (Tavily):** Ejecuta búsquedas web en tiempo real para capturar noticias del día y posturas geopolíticas actuales.
2.  **📚 Agente de Contexto (NotebookLM):** Accede a la API de NotebookLM para procesar PDFs de reglamentos específicos y resoluciones históricas.
3.  **✍️ Agente Redactor (NVIDIA NIM):** Utiliza modelos como `Llama 3 70B` para generar el borrador basándose en los "insights" de los nodos previos.
4.  **⚖️ Agente Validador (Pydantic):** Valida que las cláusulas sigan las reglas gramaticales (participio/imperativo) y de puntuación (coma/punto y coma).

---

## 5. El Modelo MUN (Protocolo Estricto)

La IA está programada para forzar el cumplimiento de los protocolos de Naciones Unidas:

### Tipos de Documentos y Reglas de IA
1.  **Position Papers:** 3 párrafos de estructura fija (Contexto, Política, Solución).
2.  **Declaraciones:** Lenguaje diplomático medido. Tono: "Expresa su profunda preocupación" vs "Odiamos esto".
3.  **Proyectos de Resolución:**
    - **Cláusulas Preambulatorias:** Verbo inicial en *cursiva* y gerundio/participio. Termina en `,`.
    - **Cláusulas Operativas:** Numeradas, verbo inicial en presente imperativo. Termina en `;`.

---

## 6. Roadmap de 40 Semanas (Estrategia Backend-First)

| Fases | Foco Primario | Semanas |
| :--- | :--- | :--- |
| **Fase 1: Infraestructura** | Setup de Spring Boot, Dockerización y Auth JWT. | S1-3 |
| **Fase 2: Gestión Documental** | Motor de plantillas, versionado Git-like y CRUD. | S4-7 |
| **Fase 3: Inteligencia Artificial** | Integración LangGraph + NVIDIA NIM + Tavily + NotebookLM. | S8-12 |
| **Fase 4: Conocimiento** | Ingesta de tratados y Setup de **Pgvector**. | S13-16 |
| **Fase 5: Colaboración** | WebSockets, Votaciones real-time y edición colaborativa. | S17-22 |
| **Fase 6: Personalización** | Feedback de usuario y métricas de progreso personal. | S23-26 |
| **Fase 7: Administración & Observabilidad** | Dashboard de control, auditoría, y configuración de **Grafana/Prometheus**. | S27-30 |
| **Fase 8: Frontend Master** | Desarrollo completo en Next.js 15, integración E2E, PWA y lanzamiento. | S31-40 |

---

## 7. Despliegue en Tiers Gratuitos (Productivo)

- **Frontend:** Vercel (Next.js 15).
- **Core Backend:** Railway / Render (Free Tier para Java/Spring).
- **AI Engine:** Render / Koyeb (Free Tier para Python).
- **Base de Datos:** **Supabase** (Postgres + Vector).
- **Redis & PubSub:** **Upstash Redis**.
- **Edge & DNS:** **Cloudflare**.

---

### ✅ Próximos Pasos (Checklist Inmediato)
1.  **Estructura de Carpetas:** Crear monorepo con `/apps/core-backend`, `/apps/ai-agents`, `/apps/web-ui`.
2.  **Docker Compose:** Configurar entorno local con Postgres y Redis.
3.  **Prototipo de Agente:** Crear script inicial de Python con LangGraph llamando a Tavily Search.
