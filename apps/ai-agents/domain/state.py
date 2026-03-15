# pyre-ignore-all-errors
from typing import TypedDict, List, Optional, Dict, Any

class AgentState(TypedDict):
    topic: str
    country: str
    committee: str
    document_type: str
    deep_research: bool
    research_queries: List[str]
    iteration_count: int
    research_data: List[str]
    legal_context: List[str]
    draft: str        # Contenido LaTeX generado
    draft_html: str   # HTML para Tiptap (convertido)
    is_valid: bool
    errors: List[str]
    strategy_guide: str
    notebook_id: Optional[str] # Contexto profesional de NotebookLM
    raw_findings: List[Dict[str, Any]] # Los 35+ resultados de investigación crudos
    recommended_indices: List[int]     # Los que la IA sugiere
    selected_indices: List[int]        # Los que el usuario elije
