<think>
The user is asking for a free alternative to the architecture I proposed. They want to build the MUN system but with free/low-cost technologies. I need to provide a comprehensive alternative stack that minimizes costs while maintaining functionality.

Let me think about free alternatives for each component:

1. Frontend Hosting: Vercel/Netlify have free tiers
2. Backend: Railway, Render, Fly.io have free tiers
3. Database: Supabase, Neon, PlanetScale have free tiers
4. Redis: Upstash has free tier
5. WebSockets: Can be self-hosted on the same server
6. IA: Open source models (Llama, Mistral) via HuggingFace, Ollama local
7. Vector DB: Qdrant, ChromaDB (self-hosted), Weaviate free tier
8. CDN: Cloudflare free tier

I should provide a practical architecture that works for small to medium conferences without significant costs.

</think>

# Arquitectura Gratuita / Low-Cost para Sistema MUN

Excelente decisión. Es completamente posible construir tu sistema con costos mínimos o cero, especialmente para comenzar. Aquí tienes la propuesta optimizada para presupuesto reducido sin sacrificar funcionalidad clave.

---

## 1. Stack Tecnológico Gratuito

### A. Frontend (Sin Costo)

| Componente | Tecnología | Plan Gratuito |
| :--- | :--- | :--- |
| **Hosting** | **Vercel** o **Netlify** | 100GB/mes, dominios personalizados |
| **Framework** | Next.js 14 + React | Open source |
| **UI Library** | Tailwind CSS + Shadcn/ui | Open source |
| **Editor** | TipTap + Yjs | Open source |
| **Estado** | Zustand | Open source |

**Configuración Vercel Free:**
- 100GB de ancho de banda mensual
- 1000 horas de ejecución de funciones serverless
- Suficiente para 50-100 usuarios concurrentes

---

### B. Backend (Sin Costo o Muy Bajo)

| Componente | Tecnología | Alternativa Free |
| :--- | :--- | :--- |
| **API Principal** | **Hono** o **Express** + Node.js | Self-hosted en Railway/Render free |
| **WebSockets** | Socket.io | Self-hosted en mismo servidor |
| **Autenticación** | **NextAuth.js** o **Clerk** | Clerk: 10,000 usuarios/mes gratis |
| **Base de Datos** | **Supabase** (PostgreSQL) | 500MB, 50,000 usuarios activos |
| **Cache/Redis** | **Upstash Redis** | 10,000 comandos/día gratis |
| **Archivos** | **Cloudflare R2** | 10GB storage, 10M lecturas/mes |

**Configuración Supabase Free:**
```
- 500MB de base de datos
- 50,000 usuarios activos mensuales
- 2GB de ancho de banda
- Autenticación incluida
- Realtime subscriptions incluido
```

---

### C. Inteligencia Artificial (Low-Cost)

| Opción | Tecnología | Costo |
| :--- | :--- | :--- |
| **Opción 1** | **Ollama + Modelos Locales** | Gratis (requiere GPU propia) |
| **Opción 2** | **HuggingFace Inference API** | Gratis (rate limited) |
| **Opción 3** | **Google Gemini API** | 60 requests/minuto gratis |
| **Opción 4** | **Groq API** | Gratis actualmente (beta) |
| **Opción 5** | **OpenAI API** | \$0.50-5 USD por conferencia |

**Recomendación:** Comienza con Groq o Gemini API gratis, escala a Ollama self-hosted si necesitas más privacidad.

---

### D. Base de Datos Vectorial (Gratis)

| Tecnología | Plan Gratuito | Notas |
| :--- | :--- | :--- |
| **ChromaDB** | Self-hosted | Python, fácil integración |
| **Qdrant** | 1GB gratis en cloud | API compatible con producción |
| **Weaviate** | 14 días trial, luego self-host | Potente pero más complejo |
| **Pgvector** | Incluido en Supabase | **MEJOR OPCIÓN** (todo en uno) |

**Recomendación:** Usa **Pgvector en Supabase**. Todo en la misma base de datos, sin servicios adicionales.

---

## 2. Arquitectura Simplificada

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTE (Vercel/Netlify)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Editor    │  │   Panel     │  │    Gestión de           │  │
│  │  (TipTap)   │  │  (Sidebar)  │  │    Sesión               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket + HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND UNIFICADO (Railway/Render Free)            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   API (Hono)     │  │   WebSockets     │  │   IA Service │  │
│  │                  │  │   (Socket.io)    │  │   (Groq API) │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Todo en Uno)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │   Pgvector   │  │      Realtime        │  │
│  │   (Datos)    │  │   (Vector)   │  │   (WebSockets DB)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Esquema de Base de Datos (Supabase + Pgvector)

```sql
-- Habilitar extensión vectorial
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de documentos con búsqueda vectorial
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    committee_id UUID REFERENCES committees(id),
    title VARCHAR(500) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('resolution', 'declaration', 'amendment')),
    status VARCHAR(50) DEFAULT 'draft',
    content TEXT,
    embedding vector(768), -- Para búsqueda semántica
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda vectorial
CREATE INDEX documents_embedding_idx ON documents USING ivfflat (embedding vector_cosine_ops);

-- Tabla de tratados y referencias (para RAG)
CREATE TABLE treaties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    content TEXT,
    embedding vector(768),
    category VARCHAR(100),
    year INTEGER
);

-- Función para búsqueda semántica
CREATE OR REPLACE FUNCTION search_treaties(query_embedding vector(768), match_count INTEGER)
RETURNS TABLE(id UUID, name VARCHAR, content TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.content, 1 - (t.embedding <=> query_embedding) AS similarity
    FROM treaties t
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Código de Ejemplo (Backend Unificado)

### A. API con Hono (TypeScript)

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { Server } from 'socket.io'
import { httpAdapter } from '@socket.io/http-adapter'

const app = new Hono()
app.use('*', cors())

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

// Endpoint para generar cláusulas con IA
app.post('/api/clauses/generate', async (c) => {
  const { clause_type, topic, country_position } = await c.req.json()
  
  // Usar Groq API (gratis actualmente)
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [{
        role: 'system',
        content: 'Eres un experto en protocolo de la ONU...'
      }, {
        role: 'user',
        content: `Genera cláusula ${clause_type} sobre ${topic}...`
      }]
    })
  })
  
  const data = await response.json()
  return c.json({ clause: data.choices[0].message.content })
})

// Búsqueda semántica de tratados
app.post('/api/treaties/search', async (c) => {
  const { query } = await c.req.json()
  
  // Generar embedding con API gratuita
  const embedding = await generateEmbedding(query)
  
  const { data } = await supabase.rpc('search_treaties', {
    query_embedding: embedding,
    match_count: 5
  })
  
  return c.json({ treaties: data })
})

export default app
```

### B. WebSockets con Socket.io

```typescript
// src/websocket.ts
import { Server } from 'socket.io'
import { createClient } from '@supabase/supabase-js'

export function setupWebSocket(server: any) {
  const io = new Server(server, {
    cors: { origin: '*' }
  })
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  )
  
  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id)
    
    // Unirse a comité
    socket.on('join_committee', (committeeId) => {
      socket.join(`committee:${committeeId}`)
    })
    
    // Lista de oradores
    socket.on('speaker_add', async ({ committeeId, country }) => {
      const { data } = await supabase
        .from('speaker_queue')
        .insert({ committee_id: committeeId, country })
        .select()
      
      io.to(`committee:${committeeId}`).emit('speaker_updated', data)
    })
    
    // Votación en tiempo real
    socket.on('vote_submit', async ({ documentId, country, vote }) => {
      await supabase
        .from('votes')
        .insert({ document_id: documentId, country_id: country, vote_type: vote })
      
      io.to(`document:${documentId}`).emit('vote_updated', { country, vote })
    })
    
    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id)
    })
  })
}
```

### C. Integración Yjs para Edición Colaborativa

```typescript
// src/yjs-provider.ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export function setupCollaborativeEditor(docId: string, userId: string) {
  const ydoc = new Y.Doc()
  
  // Usar y-websocket con backend propio
  const provider = new WebsocketProvider(
    'wss://tu-backend.com',
    `document:${docId}`,
    ydoc,
    {
      params: { userId }
    }
  )
  
  const ytext = ydoc.getText('content')
  
  // Escuchar cambios
  ytext.observe((event) => {
    console.log('Cambios detectados:', event.changes)
  })
  
  return { ydoc, ytext, provider }
}
```

---

## 5. IA Gratuita - Configuración Detallada

### Opción A: Groq API (Recomendada)

```typescript
// src/ai/groq.ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function generateClause(prompt: string) {
  const response = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500
  })
  
  return response.choices[0].message.content
}

// Costo: GRATIS actualmente (beta)
// Límites: 30 requests/minuto
```

### Opción B: Ollama Local (Self-Hosted)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelo
ollama pull llama3

# API local en http://localhost:11434
```

```typescript
// src/ai/ollama.ts
export async function generateClauseLocal(prompt: string) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3',
      prompt: prompt,
      stream: false
    })
  })
  
  const data = await response.json()
  return data.response
}

// Costo: GRATIS (usa tu propio hardware)
```

### Opción C: Google Gemini API

```typescript
// src/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateClause(prompt: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// Costo: GRATIS hasta 60 requests/minuto
```

---

## 6. Costos Reales Estimados

| Servicio | Plan Free | Costo Mensual |
| :--- | :--- | :--- |
| **Vercel** | Hobby | \$0 USD |
| **Supabase** | Free Tier | \$0 USD |
| **Upstash Redis** | Free | \$0 USD |
| **Groq API** | Beta Free | \$0 USD |
| **Cloudflare R2** | Free | \$0 USD |
| **Total** | | **\$0 USD/mes** |

**Límites del Plan Free:**
- 500MB base de datos (~100,000 cláusulas)
- 50,000 usuarios activos/mes
- 100GB ancho de banda
- 30 requests/minuto a IA

**Cuando escalar (pagar):**
- +500MB DB: \$25 USD/mes (Supabase Pro)
- +IA requests: \$50-100 USD/mes (API paga)
- +Ancho de banda: \$20 USD/mes (Vercel Pro)

---

## 7. Limitaciones y Consideraciones

| Limitación | Solución |
| :--- | :--- |
| **500MB DB** | Limpieza automática de documentos antiguos, archivar a R2 |
| **30 req/min IA** | Cola de espera, cache de respuestas similares |
| **1 servidor backend** | Suficiente para 100 usuarios concurrentes |
| **Sin SLA** | Aceptable para conferencias escolares, no para eventos críticos |
| **Cold starts** | Usar cron jobs para mantener servidor activo (UptimeRobot free) |

---

## 8. Roadmap de Implementación Free

| Semana | Tarea | Costo |
| :--- | :--- | :--- |
| 1-2 | Setup Supabase + Next.js | \$0 |
| 3-4 | Editor TipTap + Yjs básico | \$0 |
| 5-6 | WebSockets + Lista de oradores | \$0 |
| 7-8 | Integración IA (Groq/Gemini) | \$0 |
| 9-10 | Votación + Exportación PDF | \$0 |
| 11-12 | Testing + Deploy producción | \$0 |

---

## 9. Comandos de Setup Inicial

```bash
# 1. Crear proyecto Next.js
npx create-next-app@latest mun-system --typescript --tailwind

# 2. Instalar dependencias clave
npm install @supabase/supabase-js socket.io-client
npm install @tiptap/react @tiptap/starter-kit yjs y-websocket
npm install hono groq-sdk @google/generative-ai

# 3. Crear proyecto Supabase
# Ir a supabase.com -> New Project -> Free Tier

# 4. Deploy en Vercel
npx vercel deploy

# 5. Configurar variables de entorno
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
GROQ_API_KEY=your_key
```

---

¿Te gustaría que profundice en la **configuración específica de Supabase** para este caso o prefieres ver más detalles sobre cómo implementar la **edición colaborativa con Yjs** en el frontend?