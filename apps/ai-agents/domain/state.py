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
    draft: str
    draft_html: str
    is_valid: bool
    errors: List[str]
    strategy_guide: str
    notebook_id: Optional[str]
    # --- Deep Research v2 ---
    knowledge_stack: List[str]       # Pila acumulativa de conocimiento (.md fragments)
    research_brief_md: str           # Briefing final en Markdown
    research_depth: int              # Ronda actual (0-3)
    is_research_complete: bool       # Control del bucle iterativo
    raw_findings: List[Dict[str, Any]]
    recommended_indices: List[int]
    selected_indices: List[int]
    # --- User Feedback Loop ---
    user_preferences: Dict[str, Any]  # {liked_domains, disliked_domains, liked_keywords, disliked_keywords}
