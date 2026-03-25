# pyre-ignore-all-errors
import os
# pyre-ignore[21]
from langgraph.graph import StateGraph, END

# Import Domain
# pyre-ignore[21]
from domain.state import AgentState

# Import internal nodes
# pyre-ignore[21]
from nodes.agent_nodes import (
    librarian_node,
    scribe_node,
    validator_node,
    negotiator_node
)
# pyre-ignore[21]
from nodes.research_nodes import (
    researcher_node,
    scraper_node,
    evaluator_node,
    synthesizer_node,
)

# Re-exporting utils for api.py compatibility
# pyre-ignore[21]
from utils.converters import latex_to_html, html_to_latex

# pyre-ignore[21]
from langgraph.checkpoint.memory import MemorySaver

# --- [GRAPH] CONSTRUCCIÓN DEL GRAFO ---
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
try:
    # pyre-ignore[21]
    from langgraph.checkpoint.redis import RedisSaver
    memory = RedisSaver(redis_url=redis_url)
    print(f"[OK] Checkpointer conectado a Redis: {redis_url}")
except Exception as e:
    print(f"[WARN] Redis no disponible ({e}). Usando MemorySaver (en RAM).")
    memory = MemorySaver()

workflow = StateGraph(AgentState)

# ═══════════════════════════════════════════════════════════════
# NODOS
# ═══════════════════════════════════════════════════════════════

# Deep Research v2 (iterativo)
workflow.add_node("researcher", researcher_node)
workflow.add_node("scraper", scraper_node)
workflow.add_node("evaluator", evaluator_node)
workflow.add_node("synthesizer", synthesizer_node)

# Agentes existentes
workflow.add_node("librarian", librarian_node)
workflow.add_node("scribe", scribe_node)
workflow.add_node("validator", validator_node)
workflow.add_node("negotiator", negotiator_node)

# ═══════════════════════════════════════════════════════════════
# FLUJO: Investigación Iterativa + Pipeline de Redacción
# ═══════════════════════════════════════════════════════════════
#
#  researcher → scraper → evaluator →(loop)→ researcher
#                                    →(done)→ synthesizer
#  librarian ─────────────────────────────────→ synthesizer
#  synthesizer → scribe → validator → negotiator → END
#
workflow.set_entry_point("researcher")

# Investigación iterativa: buscar → scrapear → evaluar
workflow.add_edge("researcher", "scraper")
workflow.add_edge("scraper", "evaluator")

# Librarian en paralelo desde el inicio
workflow.add_edge("researcher", "librarian")

# Bucle condicional: ¿investigación completa?
workflow.add_conditional_edges(
    "evaluator",
    lambda state: "done" if state.get("is_research_complete", True) else "loop",
    {
        "done": "synthesizer",
        "loop": "researcher",
    }
)

# Fan-in: synthesizer recibe de evaluator + librarian
workflow.add_edge("librarian", "synthesizer")

# Pipeline de redacción (existente)
workflow.add_edge("synthesizer", "scribe")
workflow.add_edge("scribe", "validator")

workflow.add_conditional_edges(
    "validator",
    lambda x: "valid" if x["is_valid"] else "invalid",
    {
        "valid": "negotiator",
        "invalid": "scribe"
    }
)

workflow.add_edge("negotiator", END)

# Compilar con interrupción antes de la síntesis
app = workflow.compile(
    checkpointer=memory,
    interrupt_before=["synthesizer"]
)

print("Grafo Deep Research v2 configurado (bucle iterativo + knowledge stack).")
