# pyre-ignore-all-errors
import os
from langgraph.graph import StateGraph, END

# Import Domain
from domain.state import AgentState

# Import internal nodes
from nodes.agent_nodes import (
    researcher_node,
    librarian_node,
    scribe_node,
    validator_node,
    negotiator_node
)

# Re-exporting utils for api.py compatibility
from utils.converters import latex_to_html, html_to_latex

# --- [GRAPH] CONSTRUCCIÓN DEL GRAFO ---
# Clean Architecture: The workflow orchestration acts as an Application Service
workflow = StateGraph(AgentState)

workflow.add_node("researcher", researcher_node)
workflow.add_node("librarian", librarian_node)
workflow.add_node("scribe", scribe_node)
workflow.add_node("validator", validator_node)
workflow.add_node("negotiator", negotiator_node)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "librarian")
workflow.add_edge("librarian", "scribe")
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

app = workflow.compile()

print("Grafo de Agentes MUNify configurado correctamente y refactorizado (Clean Architecture).")
