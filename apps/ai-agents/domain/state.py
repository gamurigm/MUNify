# pyre-ignore-all-errors
from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    topic: str
    country: str
    committee: str
    document_type: str
    research_data: List[str]
    legal_context: List[str]
    draft: str        # Contenido LaTeX generado
    draft_html: str   # HTML para Tiptap (convertido)
    is_valid: bool
    errors: List[str]
    strategy_guide: str
    notebook_id: Optional[str] # Contexto profesional de NotebookLM
