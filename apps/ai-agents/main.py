# pyre-ignore-all-errors
import os
from langgraph.graph import StateGraph, END

# Import Domain
from domain.state import AgentState

# Import internal nodes
from nodes.agent_nodes import (
    librarian_node,
    scribe_node,
    validator_node,
    negotiator_node
)
from nodes.research_nodes import (
    research_planner_node,
    research_executor_node,
    research_reviewer_node,
    research_synthesizer_node
)

# Re-exporting utils for api.py compatibility
from utils.converters import latex_to_html, html_to_latex

from langgraph.checkpoint.redis import RedisSaver

# --- [GRAPH] CONSTRUCCIÓN DEL GRAFO ---
# Configuración del Checkpointer persistente en Redis
# Esto permite que el agente guarde su estado y pueda retomar la conversación o reintentar pasos fallidos.
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
memory = RedisSaver(redis_url=redis_url)
# memory.setup() # Normally setup is called during compile or first run if needed

workflow = StateGraph(AgentState)

# Nodes
workflow.add_node("research_planner", research_planner_node)
workflow.add_node("research_executor", research_executor_node)
workflow.add_node("research_reviewer", research_reviewer_node)
workflow.add_node("research_synthesizer", research_synthesizer_node)
workflow.add_node("librarian", librarian_node)
workflow.add_node("scribe", scribe_node)
workflow.add_node("validator", validator_node)
workflow.add_node("negotiator", negotiator_node)

# Configuración de Paralelismo (Fan-out)
# El planificador dispara tanto la investigación web como la legal simultáneamente
workflow.set_entry_point("research_planner")
workflow.add_edge("research_planner", "research_executor")
workflow.add_edge("research_planner", "librarian")

# Rama Web: Executor -> Reviewer (Ranking de fuentes)
workflow.add_edge("research_executor", "research_reviewer")

# Sincronización (Fan-in): Ambos flujos convergen para la síntesis
workflow.add_edge("research_reviewer", "research_synthesizer")
workflow.add_edge("librarian", "research_synthesizer")

# Punto de conexión con el resto del flujo
workflow.add_edge("research_synthesizer", "scribe")
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

# Compilar con interrupción antes de la síntesis para permitir selección del usuario
app = workflow.compile(
    checkpointer=memory,
    interrupt_before=["research_synthesizer"]
)

print("Grafo de Agentes MUNify configurado correctamente y refactorizado (Clean Architecture).")
