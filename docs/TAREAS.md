haz estas tareas detallada mente e indica como cumplida cuando lo este documenta con la fecha y hora ada una y si gue aumulando tareas:
usar los 10 principios de usabilidad de nielsen toamr en cuenta IxD, UI/UX, y diseño de interfaces. 

0. la ui siempre debe mostrar el estado del sistema ej: indicar que estan haciendo los agentes en cada momnet que fase, y de manera visulmente atractiva con efectos, moderno y tecnologico. [COMPLETADO - 2026-03-12 05:25]
1. descargar las banderas de almenos 100 paises mas representativos [COMPLETADO - 2026-03-14 19:40 - 105 banderas en local /public/flags]
2. el flujo de la simulacion debe esr mostrado en la ui [COMPLETADO - 2026-03-12 05:25]
3. el tiempo transcurrido en la session, poder pausar el tiempo [COMPLETADO - 2026-03-12 05:25]
4. poder hacer uso de la funcion de cronometro para cronomtrar tus discursos o los de los demas paises. [COMPLETADO - 2026-03-12 05:25]
5. poder tomar nota ya sea en caucus simple, debates moderados, oratoria, o en el plenario, o en negociacion, etc (plan estructurado) [COMPLETADO - 2026-03-12 05:25]
6. Implementar el "Drafting Studio": un espacio de redacción asistida por IA con plantillas oficiales de LaTeX, persistencia en tiempo real y exportación a PDF profesional. [COMPLETADO - 2026-03-12 07:05]
7. Integrar visor de documentos multiformato (PDF/DOCX) con persistencia en IndexedDB para la sala de debate. [COMPLETADO - 2026-03-12 07:05]

8. debes poder aceder y tener conteto de todos los articulos al pie de la letra de esto (carta onu, declaracion de derechos humanos, etc ): [COMPLETADO - 2026-03-12 21:55 - Cargados 265 artículos oficiales]
https://www.un.org/es/about-us/un-charter
https://www.un.org/es/about-us/universal-declaration-of-human-rights
https://www.un.org/es/about-us/un-charter/statute-of-the-international-court-of-justice
https://www.ohchr.org/es/instruments-mechanisms/instruments/convention-rights-child
accceso a estos articulos todo el tiempo es indispensable! 

- [x] Corregir sistema de envío de mensajes en el chat de Drafting Studio (API Nemotron y Sanitización implementada). [COMPLETADO - 2026-03-12 21:55]
- [x] Implementar motor de conocimiento (RAG) para consulta de tratados y convenios en tiempo real con inserción directa. [COMPLETADO - 2026-03-12 21:55]
- [x] Refinar persistencia de borradores (Verificado - Doble capa implementada LocalStorage + IndexedDB). [COMPLETADO - 2026-03-12 21:55]
- [x] Corregir error `RangeError: Schema is missing its top node type ('doc')` en el Drafting Studio (Fallo de inicialización de extensiones en el primer render). [COMPLETADO - 2026-03-14 23:05]


---
### 🚀 Roadmap de Arquitectura Pro (MUNify OpenAI-Level)
Implementar estas mejoras para escalar el sistema a un nivel profesional:

**1. Orquestación de Agentes (LangGraph)**
- **Memory Checkpointing**: Guardar estado en Redis/Postgres para reintentar pasos fallidos y auditoría de razonamiento. [COMPLETADO - 2026-03-14 19:40 - RedisSaver habilitado]
- **Human-in-the-Loop (Selection)**: Los agentes ahora recuperan 40+ fuentes, la IA recomienda las mejores (AI Reranking) y el usuario elige qué incluir. [COMPLETADO - 2026-03-14 22:45]
- **Task Queue**: Introducir Celery o Redis Streams para paralelizar investigaciones y evitar bloqueos. [COMPLETADO - 2026-03-14 22:30 - JobStore + Redis Jobs integrado]

**2. Capa RAG Avanzada**
- **Migración a Qdrant/Milvus**: Separar metadata (Postgres), vectores y almacenamiento de documentos.
- **RAG Híbrido**: Combinar búsqueda semántica + keywords (Elasticsearch/OpenSearch) para precisión legal. [COMPLETADO - 2026-03-14 19:40 - Scoring Híbrido implementado en ChromaDB]

**3. Deep Research Pipeline**
- **Reranking de Fuentes**: Filtrar por similitud de embeddings, autoridad de dominio y densidad de citas. [COMPLETADO - 2026-03-14 22:45 - Research Reviewer Node activo]
- **Knowledge Graph**: Usar Neo4j para mapear relaciones entre resoluciones, países, tratados y comités. [COMPLETADO - 2026-03-14 23:10 - Neo4j integrado en Librarian]

**4. Colaboración en Tiempo Real**
- **Awareness Server**: Escalar `y-websocket` con Redis PubSub para cientos de delegados concurrentes. [COMPLETADO - 2026-03-14 19:40 - Yjs + Redis Scaling Ready]

**5. Generación de Documentos**
- **Resolución AST**: Crear un árbol de sintaxis abstracta para validar la estructura de cláusulas preambulatorias y operativas. [COMPLETADO - 2026-03-14 19:40 - ResolutionAST Validator activo]

**6. Seguridad y Observabilidad**
- **Secrets Manager**: Usar HashiCorp Vault para rotación de tokens (NVIDIA, HF, Google).
- **Tracing & Telemetry**: Implementar sistema de monitoreo de latencia, costo de tokens y deriva de prompts. [COMPLETADO - 2026-03-14 22:55 - TelemetryService & API Endpoint activos]

**7. Sistema de Memoria Jerárquico**
- **Short-term**: Redis (contexto inmediato - Checkpointing).
- **Working memory**: Vector DB (hallazgos recientes).
- **Long-term**: Curated Knowledge Base (tratados y precedentes históricos).