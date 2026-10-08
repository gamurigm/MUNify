# MUNify v3 - Multi-Session AI Diplomacy 🚀

MUNify es una plataforma de simulación de Modelos de Naciones Unidas (MUN) de próxima generación, reconstruida en la v3 para soportar múltiples sesiones dinámicas, alto rendimiento con un Gateway en Go y agentes de IA especializados.

![MUNify Preview](./assets/images/MUNify-main-v2.png)

## ✨ Características Principales

- **🔄 Multi-Sessión**: Gestiona múltiples simulaciones independientes con contextos aislados de países y comités.
- **🤖 AI Co-Pilot**: Agentes diplomáticos integrados (investigación, redacción y validación) con RAG y NotebookLM.
- **📝 Editor Colaborativo**: Edición en tiempo real usando TipTap y Yjs gestionado por el Gateway.
- **📄 LaTeX Professional Export**: Motor de compilación en el servidor para documentos oficiales con formato de la ONU.
- **⚡ Arquitectura de Alto Rendimiento**: Gateway en Go y motor de IA en FastAPI optimizado con ONNX.

## 🛠️ Stack Tecnológico

**Frontend & UI**
![Next.js](https://img.shields.io/badge/Next.js-16+-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Gateway (Negocio & Sesiones)**
![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

**AI Agent Engine**
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-76B900?style=for-the-badge&logo=nvidia&logoColor=white)

**Infraestructura**
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## 🚀 Inicio Rápido

Para desplegar la arquitectura completa localmente:

```bash
docker compose up --build
```

O usa el script de inicio directo:
```bash
.\start-munify.bat
```

---
*MUNify v3 - Redefining digital diplomacy with Agentic AI.*
