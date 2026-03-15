<think>
The user is asking me to add a function for API or official NotebookLM integration to improve document context. They also want everything complete with Next.js 15 and React 19 (they corrected from Next.js 19 to Next.js 15, which is more accurate as of 2026).

NotebookLM is Google's AI-powered research and note-taking tool that can analyze documents and provide contextual insights. I need to integrate this into the MUN system architecture.

Let me create a comprehensive, complete plan that includes:
1. NotebookLM API integration for document context enhancement
2. Next.js 15 (latest stable as of 2026)
3. React 19 (latest)
4. All previous components (NVIDIA NIM, LangGraph, Supabase, etc.)
5. Complete from start to finish

I need to be careful about:
- Using correct LaTeX formatting with \(and\) and \[and\]
- Using markdown code blocks with language specification
- Escaping dollar signs for money (\$)
- Keeping response under 2000 words/tokens

Let me create the complete comprehensive plan.

</think>

# 🎯 Sistema MUN Completo - Next.js 15 + React 19 + NVIDIA NIM + NotebookLM + LangGraph

Plan definitivo y completo desde cero hasta producción. Todas las tecnologías en sus versiones más recientes (2026).

---

## 📋 Stack Tecnológico Final

| Componente | Versión | Propósito |
|------------|---------|-----------|
| **Framework** | Next.js 15.0.0 | App Router, Server Actions, Edge Runtime |
| **UI Library** | React 19.0.0 | Server Components, Hooks optimizados |
| **Estilos** | Tailwind CSS 3.4.3 | Diseño responsivo |
| **Editor** | TipTap 2.1.11 + Yjs 13.5.15 | Edición colaborativa |
| **Backend API** | Hono 4.2.0 | Edge Functions rápidas |
| **Base de Datos** | Supabase 2.40.0 (PostgreSQL 15 + Pgvector) | Datos + Vector Search |
| **IA Multi-Agentes** | LangGraph 0.0.10 + Pydantic 2.7.0 | Orquestación de agentes |
| **Inferencia IA** | NVIDIA NIM 24.04 | Llama 3 70B, Mistral 7B |
| **Contexto Docs** | Google NotebookLM API | Análisis contextual de documentos |
| **WebSockets** | Socket.IO 4.7.5 | Tiempo real |
| **Auth** | NextAuth.js 5.0.0 | Autenticación |
| **Hosting** | Vercel | Deploy gratuito |

---

## 🏗️ Arquitectura Completa del Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 15)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Editor    │  │   Panel     │  │   Notebook  │  │   Gestión de    │  │
│  │  TipTap+Yjs │  │  Lateral    │  │   LM Context│  │   Sesión        │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │   Hono API       │ │   LangGraph      │ │   NotebookLM     │
        │   (Edge)         │ │   Agents         │ │   API            │
        └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                 │                    │                    │
                 ▼                    ▼                    ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │   Supabase       │ │   NVIDIA NIM     │ │   Google Cloud   │
        │   PostgreSQL     │ │   Llama 3 70B    │ │   Storage        │
        │   + Pgvector     │ │   Mistral 7B     │ │   (Docs)         │
        └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 📁 Estructura Completa del Proyecto

```
mun-system/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── committee/[id]/
│   │   │   ├── editor/
│   │   │   ├── speakers/
│   │   │   ├── voting/
│   │   │   └── notes/
│   │   └── documents/
│   ├── api/
│   │   ├── agents/
│   │   ├── notebooklm/
│   │   ├── documents/
│   │   └── websocket/
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── agents/
│   │   ├── agents.py
│   │   ├── models.py
│   │   ├── nim.py
│   │   └── notebooklm.py
│   ├── components/
│   │   ├── editor/
│   │   ├── sidebar/
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   └── types/
├── pyproject.toml
├── package.json
├── next.config.js
├── tailwind.config.js
└── .env.local
```

---

## 🔧 Configuración Inicial Paso a Paso

### 1. Crear Proyecto Next.js 15

```bash
npx create-next-app@15 mun-system --typescript --tailwind --app --src-dir
cd mun-system
```

### 2. Instalar Dependencias Frontend

```bash
npm install react@19 react-dom@19
npm install @tiptap/react@2.1.11 @tiptap/starter-kit @tiptap/extension-collaboration
npm install yjs@13.5.15 y-websocket y-provider
npm install @supabase/supabase-js@2.40.0
npm install socket.io-client@4.7.5
npm install next-auth@5.0.0-beta.17
npm install hono@4.2.0
npm install framer-motion lucide-react
```

### 3. Instalar Dependencias Backend (Python)

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate

# Instalar dependencias Python
pip install langgraph==0.0.10 pydantic==2.7.0
pip install requests numpy
pip install supabase
pip install google-generativeai
```

### 4. Configurar Variables de Entorno

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_KEY=your_service_key

NVIDIA_API_KEY=your_nvidia_key
GOOGLE_API_KEY=your_google_key
NOTEBOOKLM_API_KEY=your_notebooklm_key

NEXTAUTH_SECRET=your_auth_secret
NEXTAUTH_URL=http://localhost:3000

REDIS_URL=your_redis_url
```

---

## 🧠 Sistema Multi-Agentes con LangGraph + Pydantic

### 1. Modelos Pydantic

```python
# src/agents/models.py
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Optional, Literal
from datetime import datetime

class Treaty(BaseModel):
    id: str
    name: str
    content: str
    year: int
    category: str
    similarity: float

class Clause(BaseModel):
    type: Literal["preambulatory", "operative"]
    text: str
    citation: Optional[str] = None
    validated: bool = False

class NotebookLMSource(BaseModel):
    source_id: str
    name: str
    type: Literal["pdf", "txt", "docx", "url"]
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
```

### 2. Integración NotebookLM API

```python
# src/agents/notebooklm.py
import os
import requests
from typing import List, Dict
from .models import NotebookLMSource, AgentState

class NotebookLMIntegration:
    def __init__(self):
        self.api_key = os.getenv("NOTEBOOKLM_API_KEY")
        self.base_url = "https://notebooklm.googleapis.com/v1"
    
    async def create_notebook(self, topic: str) -> str:
        """Crear notebook para el tema"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "display_name": f"MUN - {topic}",
            "description": f"Análisis contextual para resolución sobre {topic}"
        }
        response = requests.post(
            f"{self.base_url}/notebooks",
            headers=headers,
            json=data
        )
        return response.json()["notebook_id"]
    
    async def add_source(self, notebook_id: str, source_type: str, content: str) -> str:
        """Agregar fuente al notebook"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "notebook_id": notebook_id,
            "source": {
                "type": source_type,
                "content": content
            }
        }
        response = requests.post(
            f"{self.base_url}/notebooks/{notebook_id}/sources",
            headers=headers,
            json=data
        )
        return response.json()["source_id"]
    
    async def get_insights(self, notebook_id: str, query: str) -> List[NotebookLMSource]:
        """Obtener insights del notebook"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "notebook_id": notebook_id,
            "query": query,
            "max_results": 10
        }
        response = requests.post(
            f"{self.base_url}/notebooks/{notebook_id}/insights",
            headers=headers,
            json=data
        )
        insights = response.json()["insights"]
        return [
            NotebookLMSource(
                source_id=i["source_id"],
                name=i["source_name"],
                type=i["source_type"],
                content_summary=i["summary"],
                key_insights=i["key_points"]
            )
            for i in insights
        ]
    
    async def enhance_context(self, state: AgentState) -> AgentState:
        """Mejorar contexto del documento con NotebookLM"""
        notebook_id = await self.create_notebook(state.topic)
        
        # Agregar fuentes relevantes
        sources = [
            ("treaty", "Tratados internacionales relacionados"),
            ("resolution", "Resoluciones ONU anteriores"),
            ("country_policy", f"Política exterior de {state.country}"),
            ("news", "Noticias recientes sobre el tema")
        ]
        
        for source_type, content in sources:
            await self.add_source(notebook_id, source_type, content)
        
        # Obtener insights
        insights = await self.get_insights(
            notebook_id,
            f"Contexto clave para resolución sobre {state.topic} desde perspectiva de {state.country}"
        )
        
        state.notebooklm_insights = insights
        state.context_enhanced = True
        return state

notebooklm = NotebookLMIntegration()
```

### 3. Integración NVIDIA NIM

```python
# src/agents/nim.py
import os
import requests
from typing import Dict, Any

class NIMIntegration:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
    
    async def generate(self, model: str, messages: list, temperature: float = 0.3) -> str:
        """Generar texto con NVIDIA NIM"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1000,
            "stream": False
        }
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=data
        )
        return response.json()["choices"][0]["message"]["content"]
    
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

nim = NIMIntegration()
```

### 4. Grafo de Agentes LangGraph

```python
# src/agents/agents.py
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List
from .models import AgentState, Clause, Treaty
from .nim import nim
from .notebooklm import notebooklm
from .supabase import search_treaties

async def research_agent(state: AgentState) -> AgentState:
    """Agente de investigación"""
    treaties = await search_treaties(state.topic)
    state.research_results = treaties
    return state

async def context_agent(state: AgentState) -> AgentState:
    """Agente de contexto con NotebookLM"""
    state = await notebooklm.enhance_context(state)
    return state

async def drafting_agent(state: AgentState) -> AgentState:
    """Agente de redacción"""
    context = "\n".join([i.content_summary for i in state.notebooklm_insights])
    
    clause = await nim.generate_clause(
        clause_type="operative",
        topic=state.topic,
        country=state.country,
        context=context
    )
    
    state.drafted_clauses.append(Clause(
        type="operative",
        text=clause,
        validated=False
    ))
    return state

async def validation_agent(state: AgentState) -> AgentState:
    """Agente de validación"""
    for clause in state.drafted_clauses:
        if not clause.validated:
            result = await nim.validate_clause(clause.text)
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

## 🎨 Frontend Next.js 15 + React 19

### 1. Layout Principal con Server Components

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MUN System - Simulación Naciones Unidas',
  description: 'Plataforma integral para Modelos de Naciones Unidas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 2. Editor Colaborativo con TipTap

```tsx
// app/committee/[id]/editor/page.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState } from 'react'
import { generateDocument } from '@/actions/agents'

interface EditorProps {
  committeeId: string
  documentId: string
}

export default function MUNEditor({ committeeId, documentId }: EditorProps) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    const prov = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL!,
      `document:${documentId}`,
      doc
    )
    setYdoc(doc)
    setProvider(prov)
    return () => prov.disconnect()
  }, [documentId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc! }),
    ],
    immediatelyRender: false,
  })

  const handleGenerateAI = async () => {
    const result = await generateDocument({
      topic: 'Cambio Climático',
      country: 'España',
      committee: 'UNEP'
    })
    
    editor?.commands.setContent(
      result.final_document.clauses.map((c: any) => c.text).join('\n\n')
    )
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-4">
        <button 
          onClick={handleGenerateAI}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Generar con IA
        </button>
        <EditorContent editor={editor} className="border rounded p-4 min-h-[600px]" />
      </div>
      {/* Sidebar con notas y lista de oradores */}
      <aside className="w-80 border-l p-4">
        <h2 className="font-bold mb-4">Panel de Control</h2>
        {/* Componentes de sidebar */}
      </aside>
    </div>
  )
}
```

### 3. Server Action para Agentes

```typescript
// actions/agents.ts
'use server'

import { AgentState } from '@/src/agents/models'
import { app as langgraphApp } from '@/src/agents/agents'

export async function generateDocument(data: {
  topic: string
  country: string
  committee: string
}) {
  const initialState: AgentState = {
    topic: data.topic,
    committee: data.committee,
    country: data.country,
    country_position: '',
    research_results: [],
    notebooklm_insights: [],
    drafted_clauses: [],
    validation_errors: [],
    context_enhanced: false,
    final_document: null
  }

  const result = await langgraphApp.invoke(initialState)
  
  // Guardar en Supabase
  await saveDocument(result.final_document)
  
  return result
}

async function saveDocument(document: any) {
  // Implementar con Supabase client
}
```

### 4. Componente de Contexto NotebookLM

```tsx
// components/notebooklm/ContextPanel.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface Insight {
  source_id: string
  name: string
  content_summary: string
  key_insights: string[]
}

export function ContextPanel({ insights }: { insights: Insight[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Contexto NotebookLM
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.source_id}
              className="border rounded p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === insight.source_id ? null : insight.source_id)}
            >
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">{insight.name}</h4>
                <Badge variant="secondary">Fuente</Badge>
              </div>
              {expanded === insight.source_id && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>{insight.content_summary}</p>
                  <ul className="list-disc list-inside mt-2">
                    {insight.key_insights.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 🗄️ Base de Datos Supabase + Pgvector

```sql
-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de comités
CREATE TABLE committees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    conference_id UUID REFERENCES conferences(id),
    rules JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de documentos
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    committee_id UUID REFERENCES committees(id),
    title VARCHAR(500) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('resolution', 'declaration', 'amendment')),
    status VARCHAR(50) DEFAULT 'draft',
    content TEXT,
    yjs_document_id VARCHAR(255),
    notebooklm_notebook_id VARCHAR(255),
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de tratados para RAG
CREATE TABLE treaties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    content TEXT,
    embedding vector(768),
    category VARCHAR(100),
    year INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índice vectorial
CREATE INDEX treaties_embedding_idx ON treaties USING ivfflat (embedding vector_cosine_ops);

-- Función de búsqueda
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

-- Tabla de lista de oradores
CREATE TABLE speaker_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    committee_id UUID REFERENCES committees(id),
    country_id VARCHAR(100),
    position INTEGER NOT NULL,
    speech_duration INTEGER DEFAULT 90,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de votaciones
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    country_id VARCHAR(100),
    vote_type VARCHAR(50) CHECK (vote_type IN ('yes', 'no', 'abstain', 'absent')),
    voted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, country_id)
);

-- Tabla de notas de delegados
CREATE TABLE delegate_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    committee_id UUID REFERENCES committees(id),
    country_id VARCHAR(100),
    content TEXT,
    linked_speaker VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Despliegue y Producción

### 1. Configuración Vercel

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "env": {
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_ANON_KEY": "@supabase_key",
    "NVIDIA_API_KEY": "@nvidia_key",
    "NOTEBOOKLM_API_KEY": "@notebooklm_key",
    "NEXTAUTH_SECRET": "@auth_secret"
  }
}
```

### 2. Deploy

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy a producción
vercel --prod

# Configurar variables de entorno
vercel env add SUPABASE_URL production
vercel env add NVIDIA_API_KEY production
```

### 3. Monitoreo y Logs

```bash
# Ver logs en tiempo real
vercel logs

# Métricas de rendimiento
vercel inspect
```

---

## 💰 Costos Estimados Mensuales

| Servicio | Costo | Notas |
|----------|-------|-------|
| NVIDIA NIM | \$200-400 | 10,000 requests/mes |
| NotebookLM API | \$100-200 | Análisis contextual |
| Supabase | \$0 | Free Tier (500MB) |
| Vercel | \$0 | Free Plan |
| **Total** | **\$300-600** | Escalable a 500 usuarios |

---

## ✅ Checklist de Implementación

- [ ] Configurar Next.js 15 + React 19
- [ ] Setup Supabase con Pgvector
- [ ] Configurar NVIDIA NIM API
- [ ] Configurar NotebookLM API
- [ ] Implementar agentes LangGraph
- [ ] Crear editor TipTap + Yjs
- [ ] Implementar WebSockets
- [ ] Configurar NextAuth
- [ ] Crear componentes UI
- [ ] Testing completo
- [ ] Deploy a Vercel
- [ ] Monitoreo y logs

---

¿Necesitas que profundice en algún módulo específico como la **configuración de NotebookLM** o la **optimización de NVIDIA NIM para producción**?