# pyre-ignore-all-errors
import logfire
from langchain_core.messages import HumanMessage, SystemMessage
from domain.state import AgentState
from services.llm import tavily, fast_llm, critic_llm
import json

# 1. PLANNER: Genera sub-consultas de investigación
@logfire.instrument("Research Planner Node")
async def research_planner_node(state: AgentState):
    topic = state['topic']
    country = state['country']
    
    # MODO ESTÁNDAR: Evita el loop pesado si el usuario no activó Deep Research
    if not state.get("deep_research"):
        print("[OK] Modo investigación estándar seleccionado.")
        return {
            "research_queries": [f"recent geopolitical position of {country} on {topic}"],
            "iteration_count": 0,
            "research_data": [],
            "raw_findings": [],
            "recommended_indices": [],
            "selected_indices": []
        }

    print(f"--- PLANIFICANDO INVESTIGACIÓN PROFUNDA PARA: {topic} ---")
    
    prompt = f"""Como experto en investigación geopolítica del MUN, analiza el tema: "{topic}" para el país "{country}".
    Genera una lista de 5 a 8 consultas de búsqueda específicas en INGLÉS que cubran:
    1. Postura histórica oficial de {country} sobre {topic}.
    2. Declaraciones recientes de líderes de {country} en la Asamblea General o foros internacionales.
    3. Alianzas regionales y tratados firmados por {country} relacionados con el tema.
    4. Críticas o controversias internacionales que involucren a {country} sobre este tema.
    5. Datos estadísticos y económicos reales de {country} impactados por el tema.

    Responde ÚNICAMENTE con un array JSON de strings. Ejemplo: ["query 1", "query 2"]
    """
    
    response = fast_llm.invoke([
        SystemMessage(content="Eres un planificador de investigación diplomática. Respondes exclusivamente en formato JSON."),
        HumanMessage(content=prompt)
    ])
    
    try:
        # Extraer JSON de la respuesta
        text = response.content.replace('```json', '').replace('```', '').strip()
        queries = json.loads(text)
        print(f"[OK] Plan de investigación generado con {len(queries)} consultas.")
        return {
            "research_queries": queries,
            "iteration_count": 0,
            "research_data": [],
            "raw_findings": [],
            "recommended_indices": [],
            "selected_indices": []
        }
    except Exception as e:
        print(f"[ERROR] Fallo al parsear preguntas de investigación: {e}")
        return {
            "research_queries": [f"{country} official position on {topic}"],
            "iteration_count": 0,
            "research_data": []
        }

import asyncio

# 2. EXECUTOR: Ejecuta las búsquedas en paralelo usando asyncio.gather
@logfire.instrument("Research Executor Node")
async def research_executor_node(state: AgentState):
    print(f"--- EJECUTANDO INVESTIGACIÓN PARALELA (Iteración {state['iteration_count'] + 1}) ---")
    
    queries = state["research_queries"]
    search_depth = "advanced" if state["iteration_count"] == 0 else "basic"
    
    async def fetch_results(q):
        try:
            print(f"Buscando: {q}")
            # Ejecutamos la búsqueda sincrónica en un hilo dedicado para paralelismo real
            search_res = await asyncio.to_thread(
                tavily.search, query=q, search_depth=search_depth, max_results=5
            )
            return [f"FUENTE: {r['url']}\nCONTENIDO: {r['content']}" for r in search_res['results']]
        except Exception as e:
            print(f"Error en búsqueda '{q}': {e}")
            return []

    # Disparar todas las búsquedas simultáneamente
    tasks = [fetch_results(q) for q in queries]
    batch_results = await asyncio.gather(*tasks)
    
    # NUEVA LÓGICA: Almacenar resultados crudos con metadata
    all_raw = []
    for results in batch_results:
        all_raw.extend(results)
    
    print(f"[OK] Se obtuvieron {len(all_raw)} fuentes totales. Listas para revisión.")
    return {
        "raw_findings": all_raw[:40],
        "iteration_count": state["iteration_count"] + 1
    }

# 3. REVIEWER: Analiza los 35+ resultados y recomienda los mejores
@logfire.instrument("Research Reviewer Node")
async def research_reviewer_node(state: AgentState):
    print("--- IA RECOMENDANDO LAS MEJORES FUENTES (AI Reranking) ---")
    
    findings = state["raw_findings"]
    if not findings:
        return state

    # Construir un resumen mínimo de las fuentes para que el LLM las evalue
    summaries = []
    for i, f in enumerate(findings):
        # Tomamos solo el inicio del contenido para ahorrar tokens
        title = f.get('title', 'Sin título')
        content_preview = f.get('content', '')[:200]
        summaries.append(f"[{i}] {title}: {content_preview}...")

    prompt = f"""Como experto analista de la ONU, evalúa estas {len(summaries)} fuentes encontradas sobre '{state['topic']}' para {state['country']}.
    Selecciona los índices de las 6 a 10 fuentes que sean:
    1. Más autoritativas (Gobiernos, ONGs, Prensa internacional seria).
    2. Más alineadas con la soberanía y postura de {state['country']}.
    3. Más útiles para redactar un documento oficial de tipo {state.get('document_type', 'RESOLUTION')}.
    
    FUENTES:
    {chr(10).join(summaries)}
    
    Responde ÚNICAMENTE con una lista JSON de los índices recomendados. Ejemplo: [0, 4, 12, 19]
    """
    
    response = await fast_llm.ainvoke([
        SystemMessage(content="Eres un analista geopolítico experto en reranking de información."),
        HumanMessage(content=prompt)
    ])
    
    try:
        recommendations = json.loads(response.content.replace('```json', '').replace('```', '').strip())
        print(f"[OK] IA recomienda {len(recommendations)} fuentes clave.")
    except Exception as e:
        print(f"Error evaluando recomendaciones: {e}")
        recommendations = list(range(min(8, len(findings))))

    return {"recommended_indices": recommendations}

# 4. SYNTHESIZER: Toma la decisión del usuario (o IA si no hay selección) y consolida
@logfire.instrument("Research Synthesizer Node")
async def research_synthesizer_node(state: AgentState):
    print("--- CONSOLIDANDO SELECCIÓN DE INVESTIGACIÓN ---")
    
    # Si el usuario eligió índices, usamos esos. Si no, usamos los recomendados por la IA.
    # Si no hay ninguno, usamos los primeros 5 por defecto.
    target_indices = state.get("selected_indices") or state.get("recommended_indices") or list(range(min(5, len(state["raw_findings"]))))
    
    final_data = []
    for idx in target_indices:
        if idx < len(state["raw_findings"]):
            f = state["raw_findings"][idx]
            final_data.append(f"FUENTE: {f.get('url')}\nCONTENIDO: {f.get('content')}")
            
    state["research_data"] = final_data
    # Persistir en memoria permanente
    from services.knowledge_base import knowledge_base
    for fragment in final_data[:8]:
        try:
            source = "Web Research"
            if "FUENTE: " in fragment:
                parts = fragment.split("\n", 1)
                source = parts[0].replace("FUENTE: ", "")
                content = parts[1].replace("CONTENIDO: ", "")
            else:
                content = fragment
            knowledge_base.add_web_knowledge(source, content)
        except Exception as e:
            print(f"Error persistiendo fragmento: {e}")

    print(f"[OK] Investigación concluida con {len(target_indices)} fuentes. Conocimiento actualizado.")
    return {"research_data": final_data}
