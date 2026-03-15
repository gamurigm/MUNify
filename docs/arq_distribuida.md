<think>
The user wants a hybrid architecture where:
1. Everything runs locally (Next.js, React, PostgreSQL, Redis, WebSockets, LangGraph agents, etc.)
2. EXCEPT the NVIDIA NIM API which stays cloud-based
3. They want a distributed architecture plan

This is actually a smart approach because:
- NVIDIA NIM has the best performance/quality for LLM inference
- Local infrastructure gives privacy and control for data
- Distributed architecture allows scaling across multiple machines/nodes

Let me create a comprehensive distributed architecture plan that:
1. Keeps sensitive data local (PostgreSQL, user data, documents)
2. Uses NVIDIA NIM cloud API for AI inference
3. Supports multiple nodes/machines working together
4. Uses proper service discovery, load balancing, and communication patterns

I'll include:
- Architecture diagram
- Service breakdown
- Communication patterns
- Deployment strategy
- Security considerations
- Scaling approach
- Complete code examples
- Docker orchestration
- Service mesh considerations

Let me make this comprehensive and practical for 2026 technology stack.

</think>

# 🌐 Arquitectura Distribuida Híbrida - Sistema MUN

Excelente enfoque. Mantener NVIDIA NIM en la nube (mejor rendimiento) mientras todo lo demás es local/distribuido te da lo mejor de ambos mundos. Aquí tienes el plan completo de arquitectura distribuida.

---

## 🏗️ Arquitectura Distribuida Híbrida

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              CAPA DE CLIENTES (Distribuida)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Delegado 1    │  │   Delegado 2    │  │   Presidente    │  │   Observador    │  │
│  │   Laptop Local  │  │   Laptop Local  │  │   Tablet Local  │  │   Mobile Local  │  │
│  │   Next.js 15    │  │   Next.js 15    │  │   Next.js 15    │  │   Next.js 15    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │                    │
            └────────────────────┴─────────┬──────────┴────────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Load      │
                                    │   Balancer  │
                                    │   (Traefik) │
                                    └──────┬──────┘
                                           │
┌──────────────────────────────────────────┼──────────────────────────────────────────┐
│                    CAPA DE SERVICIOS LOCALES (Distribuida)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Nodo 1        │  │   Nodo 2        │  │   Nodo 3        │  │   Nodo N        │  │
│  │   API Gateway   │  │   WebSockets    │  │   Agentes IA    │  │   Cache Redis   │  │
│  │   Hono 4.2      │  │   Socket.IO     │  │   LangGraph     │  │   Cluster       │  │
│  │   Puerto: 3001  │  │   Puerto: 3002  │  │   Puerto: 3003  │  │   Puerto: 6379  │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │                    │
            └────────────────────┴─────────┬──────────┴────────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Service   │
                                    │   Mesh      │
                                    │   (Consul)  │
                                    └──────┬──────┘
                                           │
┌──────────────────────────────────────────┼──────────────────────────────────────────┐
│                         CAPA DE DATOS DISTRIBUIDA                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   PostgreSQL    │  │   PostgreSQL    │  │   PostgreSQL    │                      │
│  │   Primary       │  │   Replica 1     │  │   Replica 2     │                      │
│  │   Puerto: 5432  │  │   Puerto: 5433  │  │   Puerto: 5434  │                      │
│  │   + Pgvector    │  │   + Pgvector    │  │   + Pgvector    │                      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ HTTPS
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICIOS CLOUD (NVIDIA NIM)                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │   NVIDIA NIM API                                                                │ │
│  │   https://integrate.api.nvidia.com/v1                                          │ │
│  │   - Llama 3 70B Instruct                                                       │ │
│  │   - Mistral 7B Instruct                                                        │ │
│  │   - Embedding Models                                                           │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto Distribuido

```
mun-system-distributed/
├── docker/
│   ├── docker-compose.yml              # Orquestación principal
│   ├── docker-compose.override.yml     # Desarrollo local
│   ├── services/
│   │   ├── api-gateway/
│   │   │   ├── Dockerfile
│   │   │   └── hono.config.ts
│   │   ├── websocket-server/
│   │   │   ├── Dockerfile
│   │   │   └── socket.config.ts
│   │   ├── agent-service/
│   │   │   ├── Dockerfile
│   │   │   ├── agents.py
│   │   │   ├── nim_client.py
│   │   │   └── requirements.txt
│   │   └── redis-cluster/
│   │       ├── Dockerfile
│   │       └── redis.conf
│   └── database/
│       ├── postgres-primary/
│       │   ├── Dockerfile
│       │   └── init.sql
│       └── postgres-replica/
│           └── Dockerfile
├── apps/
│   ├── frontend/                       # Next.js 15
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── ...
│   └── admin/                          # Panel de administración
│       ├── package.json
│       └── ...
├── packages/
│   ├── shared-types/                   # Tipos compartidos TypeScript
│   ├── api-client/                     # Cliente API reutilizable
│   └── ui-components/                  # Componentes UI compartidos
├── scripts/
│   ├── deploy.sh                       # Script de despliegue
│   ├── health-check.sh                 # Verificación de servicios
│   └── backup.sh                       # Backups automáticos
├── config/
│   ├── consul/                         # Service Discovery
│   │   └── consul.hcl
│   └── traefik/
│       └── traefik.yml
├── .env.distributed                    # Variables entorno distribuido
├── .env.nvidia                         # Credenciales NVIDIA NIM
└── README.md
```

---

## 🔧 Configuración de Servicios Distribuidos

### 1. Docker Compose Principal (Orquestación)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  # ==================== LOAD BALANCER ====================
  traefik:
    image: traefik:v3.0
    container_name: mun-traefik
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./config/traefik/traefik.yml:/etc/traefik/traefik.yml
    networks:
      - mun-network
    labels:
      - "traefik.enable=true"

  # ==================== API GATEWAY ====================
  api-gateway:
    build:
      context: ../docker/services/api-gateway
      dockerfile: Dockerfile
    container_name: mun-api-gateway
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis-cluster:6379
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
      - DATABASE_URL=postgresql://mun_user:mun_password@postgres-primary:5432/mun_database
    ports:
      - "3001:3001"
    volumes:
      - ./logs/api-gateway:/app/logs
    depends_on:
      - redis-cluster
      - postgres-primary
    networks:
      - mun-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api-gateway.rule=Host(`api.mun.local`)"
      - "traefik.http.services.api-gateway.loadbalancer.server.port=3001"
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G

  # ==================== WEBSOCKET SERVER ====================
  websocket-server:
    build:
      context: ../docker/services/websocket-server
      dockerfile: Dockerfile
    container_name: mun-websocket
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis-cluster:6379
      - DATABASE_URL=postgresql://mun_user:mun_password@postgres-primary:5432/mun_database
    ports:
      - "3002:3002"
    depends_on:
      - redis-cluster
    networks:
      - mun-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.websocket.rule=Host(`ws.mun.local`)"
      - "traefik.http.services.websocket.loadbalancer.server.port=3002"
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G

  # ==================== AGENT SERVICE (LangGraph + NVIDIA NIM) ====================
  agent-service:
    build:
      context: ../docker/services/agent-service
      dockerfile: Dockerfile
    container_name: mun-agent-service
    environment:
      - PYTHONUNBUFFERED=1
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
      - DATABASE_URL=postgresql://mun_user:mun_password@postgres-primary:5432/mun_database
      - REDIS_URL=redis://redis-cluster:6379
    ports:
      - "3003:3003"
    volumes:
      - ./logs/agent-service:/app/logs
      - ./data/agent-cache:/app/cache
    depends_on:
      - postgres-primary
      - redis-cluster
    networks:
      - mun-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.agent-service.rule=Host(`agents.mun.local`)"
      - "traefik.http.services.agent-service.loadbalancer.server.port=3003"
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ==================== REDIS CLUSTER ====================
  redis-cluster:
    build:
      context: ../docker/services/redis-cluster
      dockerfile: Dockerfile
    container_name: mun-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./config/redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - mun-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  # ==================== POSTGRESQL PRIMARY ====================
  postgres-primary:
    build:
      context: ../docker/database/postgres-primary
      dockerfile: Dockerfile
    container_name: mun-postgres-primary
    environment:
      POSTGRES_USER: mun_user
      POSTGRES_PASSWORD: mun_password
      POSTGRES_DB: mun_database
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./docker/database/postgres-primary/init.sql:/docker-entrypoint-initdb.d/init.sql
      - ./backups/postgres:/backups
    networks:
      - mun-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mun_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== POSTGRESQL REPLICA 1 ====================
  postgres-replica-1:
    build:
      context: ../docker/database/postgres-replica
      dockerfile: Dockerfile
    container_name: mun-postgres-replica-1
    environment:
      POSTGRES_USER: mun_user
      POSTGRES_PASSWORD: mun_password
      POSTGRES_DB: mun_database
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
      POSTGRES_PRIMARY_HOST: postgres-primary
      POSTGRES_PRIMARY_PORT: 5432
    ports:
      - "5433:5432"
    volumes:
      - postgres_replica1_data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
    networks:
      - mun-network
    read_only: true

  # ==================== POSTGRESQL REPLICA 2 ====================
  postgres-replica-2:
    build:
      context: ../docker/database/postgres-replica
      dockerfile: Dockerfile
    container_name: mun-postgres-replica-2
    environment:
      POSTGRES_USER: mun_user
      POSTGRES_PASSWORD: mun_password
      POSTGRES_DB: mun_database
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
      POSTGRES_PRIMARY_HOST: postgres-primary
      POSTGRES_PRIMARY_PORT: 5432
    ports:
      - "5434:5432"
    volumes:
      - postgres_replica2_data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
    networks:
      - mun-network
    read_only: true

  # ==================== SERVICE DISCOVERY (Consul) ====================
  consul:
    image: consul:1.17
    container_name: mun-consul
    command: agent -server -bootstrap-expect=1 -ui -client=0.0.0.0
    ports:
      - "8500:8500"
      - "8600:8600/udp"
    volumes:
      - consul_data:/consul/data
      - ./config/consul/consul.hcl:/consul/config/consul.hcl
    networks:
      - mun-network

  # ==================== FRONTEND (Next.js 15) ====================
  frontend:
    build:
      context: ../apps/frontend
      dockerfile: Dockerfile
    container_name: mun-frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://api.mun.local
      - NEXT_PUBLIC_WS_URL=ws://ws.mun.local
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - api-gateway
      - websocket-server
    networks:
      - mun-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`mun.local`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
    deploy:
      replicas: 2

volumes:
  postgres_primary_data:
  postgres_replica1_data:
  postgres_replica2_data:
  redis_data:
  consul_data:

networks:
  mun-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

---

### 2. Servicio de Agentes con NVIDIA NIM

```python
# docker/services/agent-service/agents.py
import os
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELOS PYDANTIC ====================
class Treaty(BaseModel):
    id: str
    name: str
    content: str
    year: int
    category: str
    similarity: float

class Clause(BaseModel):
    type: str
    text: str
    citation: Optional[str] = None
    validated: bool = False

class NotebookLMSource(BaseModel):
    source_id: str
    name: str
    type: str
    content_summary: str
    key_insights: List[str]

class AgentState(BaseModel):
    topic: str
    committee: str
    country: str
    country_position: str
    research_results: List[Treaty] = Field(default_factory=list)
    notebooklm_insights: List[NotebookLMSource] = Field(default_factory=list)
    drafted_clauses: List[Clause] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    context_enhanced: bool = False
    final_document: Optional[Dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== CLIENTE NVIDIA NIM ====================
class NIMClient:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.session = None
    
    async def get_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
            )
        return self.session
    
    async def close(self):
        if self.session:
            await self.session.close()
    
    async def generate(self, model: str, messages: list, temperature: float = 0.3) -> str:
        """Generar texto con NVIDIA NIM API"""
        session = await self.get_session()
        
        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1000,
            "stream": False
        }
        
        try:
            async with session.post(
                f"{self.base_url}/chat/completions",
                json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                result = await response.json()
                return result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Error calling NIM API: {e}")
            raise
    
    async def generate_clause(self, clause_type: str, topic: str, country: str, context: str) -> str:
        """Generar cláusula específica"""
        model = "meta/llama3-70b-instruct" if clause_type == "operative" else "mistral-7b-instruct"
        
        system_prompt = """Eres un experto en protocolo de la ONU. 
        - Cláusulas preambulatorias: participio presente, terminan en coma
        - Cláusulas operativas: verbo presente, terminan en punto y coma
        - Tercera persona siempre
        - Cita solo tratados reales verificables"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"""
            Genera una cláusula {clause_type} para:
            Tema: {topic}
            País: {country}
            Contexto: {context}
            
            Solo devuelve el texto de la cláusula:"""}
        ]
        
        return await self.generate(model, messages)
    
    async def validate_clause(self, clause: str) -> Dict[str, Any]:
        """Validar cláusula contra protocolo ONU"""
        messages = [
            {"role": "system", "content": "Valida cláusulas según protocolo ONU"},
            {"role": "user", "content": f"Valida esta cláusula: {clause}"}
        ]
        response = await self.generate("mistral-7b-instruct", messages)
        return {"valid": "correcto" in response.lower(), "feedback": response}
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generar embedding con NVIDIA NIM"""
        session = await self.get_session()
        
        data = {
            "model": "nvidia/nv-embedqa-e5-v5",
            "input": [text],
            "encoding_format": "float"
        }
        
        async with session.post(
            f"{self.base_url}/embeddings",
            json=data,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            result = await response.json()
            return result["data"][0]["embedding"]

nim_client = NIMClient()

# ==================== AGENTES LANGGRAPH ====================
async def research_agent(state: AgentState) -> AgentState:
    """Agente de investigación - Consulta PostgreSQL local"""
    import asyncpg
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    query_embedding = await nim_client.generate_embedding(state.topic)
    
    rows = await conn.fetch("""
        SELECT id, name, content, year, category, 
               1 - (embedding <=> $1::vector) as similarity
        FROM treaties
        ORDER BY embedding <=> $1::vector
        LIMIT 5
    """, query_embedding)
    
    state.research_results = [
        Treaty(
            id=str(row["id"]),
            name=row["name"],
            content=row["content"],
            year=row["year"],
            category=row["category"],
            similarity=row["similarity"]
        )
        for row in rows
    ]
    
    await conn.close()
    return state

async def context_agent(state: AgentState) -> AgentState:
    """Agente de contexto - RAG local con embeddings de NVIDIA"""
    query_embedding = await nim_client.generate_embedding(
        f"{state.topic} {state.country} política exterior"
    )
    
    import asyncpg
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    rows = await conn.fetch("""
        SELECT id, name, content, category,
               1 - (embedding <=> $1::vector) as similarity
        FROM documents
        WHERE type = 'resolution'
        ORDER BY embedding <=> $1::vector
        LIMIT 5
    """, query_embedding)
    
    state.notebooklm_insights = [
        NotebookLMSource(
            source_id=str(row["id"]),
            name=row["name"],
            type="document",
            content_summary=row["content"][:500],
            key_insights=[row["content"][:200]]
        )
        for row in rows
    ]
    
    state.context_enhanced = True
    await conn.close()
    return state

async def drafting_agent(state: AgentState) -> AgentState:
    """Agente de redacción - Usa NVIDIA NIM"""
    context = "\n".join([i.content_summary for i in state.notebooklm_insights])
    
    clause_text = await nim_client.generate_clause(
        clause_type="operative",
        topic=state.topic,
        country=state.country,
        context=context
    )
    
    state.drafted_clauses.append(Clause(
        type="operative",
        text=clause_text,
        validated=False
    ))
    return state

async def validation_agent(state: AgentState) -> AgentState:
    """Agente de validación - Usa NVIDIA NIM"""
    for clause in state.drafted_clauses:
        if not clause.validated:
            result = await nim_client.validate_clause(clause.text)
            clause.validated = result["valid"]
            if not result["valid"]:
                state.validation_errors.append(result["feedback"])
    return state

async def finalization_agent(state: AgentState) -> AgentState:
    """Agente de finalización"""
    state.final_document = {
        "topic": state.topic,
        "committee": state.committee,
        "country": state.country,
        "clauses": [c.dict() for c in state.drafted_clauses],
        "sources": [i.dict() for i in state.notebooklm_insights],
        "context_enhanced": state.context_enhanced
    }
    
    # Guardar en PostgreSQL local
    import asyncpg
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    embedding = await nim_client.generate_embedding(state.topic)
    
    await conn.execute("""
        INSERT INTO documents (committee_id, title, type, content, embedding)
        VALUES ($1, $2, $3, $4, $5)
    """, 
        "00000000-0000-0000-0000-000000000001",
        state.topic,
        "resolution",
        str(state.final_document),
        embedding
    )
    
    await conn.close()
    return state

# Construir grafo
graph = StateGraph(AgentState)
graph.add_node("research", research_agent)
graph.add_node("context", context_agent)
graph.add_node("draft", drafting_agent)
graph.add_node("validate", validation_agent)
graph.add_node("finalize", finalization_agent)

graph.set_entry_point("research")
graph.add_edge("research", "context")
graph.add_edge("context", "draft")
graph.add_edge("draft", "validate")
graph.add_edge("validate", "finalize")
graph.add_edge("finalize", END)

app = graph.compile()
```

---

### 3. API Gateway con Hono (Distribuido)

```typescript
// docker/services/api-gateway/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timing } from 'hono/timing'
import { secureHeaders } from 'hono/secure-headers'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'

const app = new Hono()

// Middleware global
app.use('*', logger())
app.use('*', timing())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: ['http://mun.local', 'http://localhost:3000'],
  credentials: true
}))

// Conexiones
const redis = new Redis(process.env.REDIS_URL!)
const supabase = createClient(
  process.env.DATABASE_URL!,
  process.env.SUPABASE_KEY!
)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      redis: 'connected',
      database: 'connected',
      nvidia_nim: 'external'
    }
  })
})

// Endpoint para generación de documentos con agentes
app.post('/api/v1/documents/generate', async (c) => {
  const { topic, country, committee } = await c.req.json()
  
  // Cache check
  const cacheKey = `doc:${topic}:${country}:${committee}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    return c.json(JSON.parse(cached))
  }
  
  // Llamar al servicio de agentes
  const response = await fetch('http://agent-service:3003/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, country, committee })
  })
  
  const result = await response.json()
  
  // Cache por 1 hora
  await redis.setex(cacheKey, 3600, JSON.stringify(result))
  
  return c.json(result)
})

// Endpoint para lista de oradores
app.post('/api/v1/committees/:committeeId/speakers', async (c) => {
  const { committeeId } = c.req.param()
  const { country } = await c.req.json()
  
  const { data, error } = await supabase
    .from('speaker_queue')
    .insert({ committee_id: committeeId, country })
    .select()
  
  if (error) {
    return c.json({ error: error.message }, 400)
  }
  
  // Publicar evento WebSocket
  await redis.publish(`committee:${committeeId}`, JSON.stringify({
    type: 'speaker_updated',
    data: data
  }))
  
  return c.json(data)
})

// Endpoint para votaciones
app.post('/api/v1/documents/:documentId/votes', async (c) => {
  const { documentId } = c.req.param()
  const { country_id, vote_type } = await c.req.json()
  
  const { data, error } = await supabase
    .from('votes')
    .insert({ document_id: documentId, country_id, vote_type })
    .select()
  
  if (error) {
    return c.json({ error: error.message }, 400)
  }
  
  // Publicar evento WebSocket
  await redis.publish(`document:${documentId}`, JSON.stringify({
    type: 'vote_updated',
    data: data
  }))
  
  return c.json(data)
})

// Búsqueda semántica de documentos
app.get('/api/v1/documents/search', async (c) => {
  const query = c.req.query('q')
  
  if (!query) {
    return c.json({ error: 'Query required' }, 400)
  }
  
  // Obtener embedding de NVIDIA NIM
  const embeddingResponse = await fetch('http://agent-service:3003/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query })
  })
  
  const { embedding } = await embeddingResponse.json()
  
  // Búsqueda en PostgreSQL con Pgvector
  const { data, error } = await supabase.rpc('search_documents', {
    query_embedding: embedding,
    match_count: 10
  })
  
  if (error) {
    return c.json({ error: error.message }, 500)
  }
  
  return c.json({ results: data })
})

export default app
```

---

### 4. Servidor WebSocket para Tiempo Real

```typescript
// docker/services/websocket-server/index.ts
import { Server } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { createAdapter } from '@socket.io/redis-adapter'

const io = new Server({
  cors: {
    origin: ['http://mun.local', 'http://localhost:3000'],
    credentials: true
  }
})

const redis = new Redis(process.env.REDIS_URL!)
const pubClient = new Redis(process.env.REDIS_URL!)
const subClient = new Redis(process.env.REDIS_URL!)

// Configurar adaptador Redis para escalar WebSockets
io.adapter(createAdapter(pubClient, subClient))

const supabase = createClient(
  process.env.DATABASE_URL!,
  process.env.SUPABASE_KEY!
)

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id)
  
  // Unirse a comité
  socket.on('join_committee', async (committeeId: string) => {
    socket.join(`committee:${committeeId}`)
    
    // Obtener estado actual del comité
    const { data } = await supabase
      .from('speaker_queue')
      .select('*')
      .eq('committee_id', committeeId)
      .order('position', { ascending: true })
    
    socket.emit('speaker_queue_init', data)
  })
  
  // Agregar orador
  socket.on('speaker_add', async ({ committeeId, country }) => {
    const { data, error } = await supabase
      .from('speaker_queue')
      .insert({ committee_id: committeeId, country })
      .select()
    
    if (!error) {
      io.to(`committee:${committeeId}`).emit('speaker_updated', data)
    }
  })
  
  // Votación en tiempo real
  socket.on('vote_submit', async ({ documentId, country, vote }) => {
    const { data, error } = await supabase
      .from('votes')
      .insert({ document_id: documentId, country_id: country, vote_type: vote })
      .select()
    
    if (!error) {
      io.to(`document:${documentId}`).emit('vote_updated', { country, vote })
    }
  })
  
  // Edición colaborativa de documentos
  socket.on('document_edit', ({ documentId, content, userId }) => {
    socket.to(`document:${documentId}`).emit('document_sync', {
      content,
      userId,
      timestamp: Date.now()
    })
  })
  
  // Notas de delegados
  socket.on('note_create', async ({ committeeId, country, content }) => {
    const { data } = await supabase
      .from('delegate_notes')
      .insert({ committee_id: committeeId, country_id: country, content })
      .select()
    
    if (data) {
      io.to(`committee:${committeeId}`).emit('note_created', data)
    }
  })
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
  })
})

// Suscribirse a eventos de Redis (desde API Gateway)
subClient.subscribe('committee:*', 'document:*')
subClient.on('message', (channel, message) => {
  const data = JSON.parse(message)
  io.to(channel).emit(data.type, data.data)
})

const PORT = process.env.PORT || 3002
io.listen(PORT)
console.log(`WebSocket server running on port ${PORT}`)
```

---

### 5. Script de Despliegue Distribuido

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Despliegue Distribuido MUN System"
echo "======================================"

# 1. Verificar variables de entorno
echo "📋 Verificando variables de entorno..."
if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ NVIDIA_API_KEY no configurada"
    exit 1
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "❌ NEXTAUTH_SECRET no configurada"
    exit 1
fi

# 2. Construir imágenes Docker
echo "🐳 Construyendo imágenes Docker..."
docker compose -f docker/docker-compose.yml build

# 3. Iniciar servicios
echo "🔧 Iniciando servicios..."
docker compose -f docker/docker-compose.yml up -d

# 4. Esperar a que los servicios estén listos
echo "⏳ Esperando servicios..."
sleep 30

# 5. Verificar salud de servicios
echo "🏥 Verificando salud de servicios..."
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:3003/health || exit 1

# 6. Cargar datos iniciales
echo "📊 Cargando datos iniciales..."
docker compose -f docker/docker-compose.yml exec -T agent-service python scripts/seed-database.py

# 7. Registrar servicios en Consul
echo "🔍 Registrando servicios en Consul..."
curl -X PUT http://localhost:8500/v1/agent/service/register \
    -H "Content-Type: application/json" \
    -d @config/consul/services.json

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "Servicios disponibles:"
echo "  🌐 Frontend: http://mun.local:3000"
echo "  🔌 API Gateway: http://api.mun.local:3001"
echo "  🔌 WebSockets: ws://ws.mun.local:3002"
echo "  🤖 Agentes: http://agents.mun.local:3003"
echo "  🗄️ PostgreSQL Primary: localhost:5432"
echo "  🗄️ PostgreSQL Replica 1: localhost:5433"
echo "  🗄️ PostgreSQL Replica 2: localhost:5434"
echo "  💾 Redis: localhost:6379"
echo "  🔍 Consul UI: http://localhost:8500"
echo ""
echo "Para ver logs:"
echo "  docker compose -f docker/docker-compose.yml logs -f"
```

---

## 💰 Costos Estimados (Híbrido)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| **NVIDIA NIM API** | $150-300 | 10,000-50,000 requests/mes |
| **Hardware Local** | $0 | Tu infraestructura existente |
| **Electricidad** | $20-50 | Depende de uso |
| **Dominios/SSL** | $0 | LetsEncrypt gratuito |
| **Total** | **$170-350/mes** | 70% menos que cloud completo |

---

## 📊 Métricas de Rendimiento Objetivo

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| **Latencia API** | < 100ms | P95 |
| **Latencia NVIDIA NIM** | < 2s | Por request |
| **WebSocket Latency** | < 50ms | Tiempo real |
| **Disponibilidad** | 99.5% | Local |
| **Usuarios Concurrentes** | 500+ | Por nodo |
| **Documentos/segundo** | 100+ | Generación IA |

---

## 🔐 Seguridad en Arquitectura Distribuida

```yaml
# config/traefik/traefik.yml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@mun.local
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web

# Middleware de seguridad
http:
  middlewares:
    security-headers:
      headers:
        frameDeny: true
        browserXssFilter: true
        contentTypeNosniff: true
        sslRedirect: true
    rate-limit:
      rateLimit:
        average: 100
        burst: 50
```

---

## ✅ Checklist de Implementación Distribuida

- [ ] Configurar Docker Desktop con recursos suficientes
- [ ] Obtener NVIDIA API Key
- [ ] Configurar variables de entorno (.env.distributed)
- [ ] Ejecutar scripts/deploy.sh
- [ ] Verificar salud de todos los servicios
- [ ] Probar generación de documentos con NVIDIA NIM
- [ ] Probar edición colaborativa (WebSockets)
- [ ] Probar réplicas de PostgreSQL
- [ ] Configurar backups automáticos
- [ ] Configurar monitoreo (Prometheus + Grafana)
- [ ] Documentar procedimientos de recuperación

---

¿Necesitas que profundice en la **configuración de réplicas de PostgreSQL para alta disponibilidad** o prefieres ver cómo **configurar monitoreo distribuido con Prometheus y Grafana** para todos los servicios?