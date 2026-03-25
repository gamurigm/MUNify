# pyre-ignore-all-errors
"""
Deep Research Engine v2 — Proceso Iterativo con Pila de Conocimiento.

Flujo: researcher → scraper → evaluator → (loop | synthesizer)
Cada ronda apila conocimiento en knowledge_stack.
Los archivos .md en prompts/ definen el comportamiento de cada nodo.
"""
import json
import asyncio
from pathlib import Path

import logfire
from langchain_core.messages import HumanMessage, SystemMessage

from domain.state import AgentState
from services.llm import tavily, fast_llm
from services.deep_crawler import crawler

# ─── Utilidad: Leer archivos de instrucciones .md ───
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

def _load_prompt(name: str) -> str:
    """Lee un archivo .md de instrucciones desde prompts/."""
    path = PROMPTS_DIR / name
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return f"(Archivo {name} no encontrado)"


# ═══════════════════════════════════════════════════════════════
# 1. RESEARCHER: Genera queries y busca con Tavily
# ═══════════════════════════════════════════════════════════════
@logfire.instrument("Deep Researcher Node")
async def researcher_node(state: AgentState):
    topic = state["topic"]
    country = state["country"]
    depth = state.get("research_depth", 0)
    stack = state.get("knowledge_stack", [])

    # Modo estándar (sin deep research)
    if not state.get("deep_research"):
        return {
            "research_queries": [f"recent geopolitical position of {country} on {topic}"],
            "research_depth": 0,
            "knowledge_stack": [],
            "raw_findings": [],
            "is_research_complete": False,
        }

    print(f"--- [DEEP RESEARCH] Ronda {depth + 1} de investigación ---")

    # Leer instrucciones del archivo .md
    instructions = _load_prompt("researcher.md")

    # Contexto acumulado para que el LLM sepa qué ya tiene
    stack_summary = ""
    if stack:
        stack_summary = (
            f"\n\nYa tenemos {len(stack)} fragmentos de conocimiento. "
            f"Resumen parcial:\n" + "\n".join(f"- {s[:120]}..." for s in stack[:5])
        )

    prompt = f"""{instructions}

MISIÓN ACTUAL:
- País: {country}
- Tema: {topic}
- Ronda: {depth + 1} de 3
{stack_summary}

Genera las consultas de búsqueda para esta ronda.
"""

    response = await fast_llm.ainvoke([
        SystemMessage(content="Eres un investigador geopolítico de élite. Responde SOLO con un array JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = str(getattr(response, "content", "[]"))
        queries = json.loads(content.replace("```json", "").replace("```", "").strip())
    except Exception:
        queries = [f"{country} {topic} UN resolution", f"{country} {topic} treaty"]

    # Ejecutar búsquedas en paralelo con Tavily
    async def search(q):
        try:
            res = await asyncio.to_thread(
                tavily.search, query=q, search_depth="advanced", max_results=6
            )
            return res.get("results", [])
        except Exception:
            return []

    tasks = [search(q) for q in queries]
    batches = await asyncio.gather(*tasks)

    new_findings = []
    for batch in batches:
        if isinstance(batch, list):
            new_findings.extend(batch)

    # Acumular hallazgos
    existing = list(state.get("raw_findings") or [])
    existing.extend(new_findings)

    print(f"[OK] Ronda {depth + 1}: +{len(new_findings)} fuentes ({len(existing)} total)")
    return {
        "raw_findings": existing[:80],
        "research_depth": depth + 1,
    }


# ═══════════════════════════════════════════════════════════════
# 2. SCRAPER: crawl4ai en las mejores URLs → Markdown
# ═══════════════════════════════════════════════════════════════
@logfire.instrument("Deep Scraper Node")
async def scraper_node(state: AgentState):
    findings = state.get("raw_findings", [])
    depth = state.get("research_depth", 1)

    if not findings:
        return {"knowledge_stack": state.get("knowledge_stack", [])}

    print(f"--- [DEEP SCRAPER] Ronda {depth}: scrapeando top fuentes ---")

    # Seleccionar las top-3 URLs que NO hayamos scrapeado aún
    stack = list(state.get("knowledge_stack") or [])
    already_scraped = {s.split("\n")[0] for s in stack if s.startswith("FUENTE:")}

    urls_to_scrape = []
    for f in findings:
        url = f.get("url", "")
        if url and url not in already_scraped and len(urls_to_scrape) < 3:
            urls_to_scrape.append(url)

    if not urls_to_scrape:
        print("[SCRAPER] No hay URLs nuevas para scrapear.")
        return {"knowledge_stack": stack}

    # Scraping profundo con crawl4ai
    contents = await crawler.crawl_many(urls_to_scrape)

    for url, content in zip(urls_to_scrape, contents):
        if content and len(content) > 100:
            fragment = f"FUENTE: {url}\n{content[:4000]}"
            stack.append(fragment)
            print(f"  ✓ {url[:60]}... ({len(content)} chars)")
        else:
            print(f"  ✗ {url[:60]}... (sin contenido)")

    # También apilar los snippets de Tavily que no se scrapearon
    for f in findings[:10]:
        snippet = f.get("content", "")
        url = f.get("url", "")
        if snippet and len(snippet) > 50:
            mini = f"SNIPPET: {url}\n{snippet[:800]}"
            if mini not in stack:
                stack.append(mini)

    print(f"[OK] Knowledge stack: {len(stack)} fragmentos acumulados")
    return {"knowledge_stack": stack}


# ═══════════════════════════════════════════════════════════════
# 3. EVALUATOR: ¿Es suficiente? ¿Necesitamos otra ronda?
# ═══════════════════════════════════════════════════════════════
@logfire.instrument("Deep Evaluator Node")
async def evaluator_node(state: AgentState):
    stack = state.get("knowledge_stack", [])
    depth = state.get("research_depth", 0)

    print(f"--- [EVALUATOR] Ronda {depth}: evaluando {len(stack)} fragmentos ---")

    # Límite de seguridad
    if depth >= 3 or not stack:
        return {"is_research_complete": True}

    instructions = _load_prompt("evaluator.md")

    # Preparar resumen del stack para el LLM (no enviar todo, sería demasiado)
    stack_preview = "\n---\n".join(s[:300] for s in stack[:8])

    prompt = f"""{instructions}

TEMA: {state['topic']}
PAÍS: {state['country']}
RONDA ACTUAL: {depth}
FRAGMENTOS RECOLECTADOS: {len(stack)}

PREVIEW DEL KNOWLEDGE STACK:
{stack_preview}

Evalúa la suficiencia y responde en JSON.
"""

    response = await fast_llm.ainvoke([
        SystemMessage(content="Eres un analista de inteligencia diplomática. Responde SOLO en JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = str(getattr(response, "content", "{}"))
        decision = json.loads(content.replace("```json", "").replace("```", "").strip())
        is_complete = decision.get("is_complete", True)
        confidence = decision.get("confidence", 0.5)

        # Si la confianza es alta y ya tenemos 2+ rondas, terminamos
        if confidence >= 0.75 or depth >= 2:
            is_complete = True

        if not is_complete:
            # Inyectar las queries sugeridas para la siguiente ronda
            next_q = decision.get("next_queries", [])
            print(f"[EVALUATOR] Insuficiente (confianza={confidence:.1f}). Lagunas: {decision.get('missing', [])}")
            return {
                "is_research_complete": False,
                "research_queries": next_q if next_q else [f"{state['country']} {state['topic']} details"],
            }

        print(f"[EVALUATOR] Completo (confianza={confidence:.1f})")
        return {"is_research_complete": True}

    except Exception:
        # Si falla el parsing, damos por completo
        return {"is_research_complete": True}


# ═══════════════════════════════════════════════════════════════
# 4. SYNTHESIZER: Genera el briefing final en .md
# ═══════════════════════════════════════════════════════════════
@logfire.instrument("Deep Synthesizer Node")
async def synthesizer_node(state: AgentState):
    stack = state.get("knowledge_stack", [])
    depth = state.get("research_depth", 0)

    print(f"--- [SYNTHESIZER] Generando briefing .md ({len(stack)} fuentes, {depth} rondas) ---")

    output_template = _load_prompt("output_format.md")

    # Preparar el conocimiento acumulado (enviar todo al LLM)
    full_context = "\n\n---\n\n".join(stack[:15])  # Top 15 fragmentos

    prompt = f"""Usa esta plantilla para generar el briefing final:

{output_template}

Variables:
- TEMA: {state['topic']}
- PAÍS: {state['country']}
- COMITÉ: {state.get('committee', 'N/A')}
- N_RONDAS: {depth}

CONOCIMIENTO ACUMULADO (Knowledge Stack):
{full_context}

Genera el briefing completo en Markdown, llenando cada sección con la información real del knowledge stack.
No inventes datos. Si no tienes información para una sección, escríbelo explícitamente.
"""

    response = await fast_llm.ainvoke([
        SystemMessage(content="Eres un redactor de briefings de inteligencia diplomática. Generas Markdown impecable."),
        HumanMessage(content=prompt),
    ])

    brief = str(getattr(response, "content", ""))

    # Persistir en Knowledge Base
    try:
        from services.knowledge_base import knowledge_base
        for fragment in stack[:10]:
            knowledge_base.add_web_knowledge("Deep Research v2", fragment)
    except Exception as e:
        print(f"KB persistence skipped: {e}")

    print(f"[OK] Briefing generado ({len(brief)} chars)")
    return {
        "research_brief_md": brief,
        "research_data": [brief] + stack[:5],  # Compatible con el Scribe existente
    }
