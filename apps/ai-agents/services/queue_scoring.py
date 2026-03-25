# pyre-ignore-all-errors
# type: ignore
"""
MUNify Queue Scoring Engine — Algorithmic Priority Weighting

Uses a weighted utility formula inspired by Dynamic Programming (Knapsack diversity)
and lightweight ML (cosine similarity via embeddings) to compute a final utility score
for each source in the Priority Queue.

Formula:  U = (α · S_context) + (β · R_feedback) + (γ · I_source) - (δ · P_redundancy)

Where:
  S_context   = Cosine similarity between source embedding and the engineering context / .md file
  R_feedback  = Reward from user feedback history (inject/promote → +, delete → -)
  I_source    = Hardcoded source reliability index (un.org → 1.0, reuters → 0.8, etc.)
  P_redundancy = Dynamic Programming penalty for redundant coverage (Knapsack diversity)
"""

import math
from typing import List, Dict, Any, Optional, Set, Tuple
import logfire  # pyre-ignore

# ═══════════════════════════════════════════════════════════════
# SOURCE RELIABILITY INDEX (Hardcoded Trust Scores)
# ═══════════════════════════════════════════════════════════════
SOURCE_TRUST: Dict[str, float] = {
    # Fuentes primarias (1.0)
    "un.org": 1.0,
    "ohchr.org": 1.0,
    "icj-cij.org": 1.0,
    "europa.eu": 0.95,
    "oas.org": 0.95,
    # ONG de alto reconocimiento (0.85)
    "amnesty.org": 0.85,
    "hrw.org": 0.85,
    "icrc.org": 0.90,
    # Think Tanks (0.80)
    "foreignaffairs.com": 0.80,
    "sipri.org": 0.85,
    "brookings.edu": 0.80,
    # Medios de referencia (0.75)
    "reuters.com": 0.75,
    "bbc.com": 0.75,
    "bbc.co.uk": 0.75,
    "aljazeera.com": 0.70,
    "theguardian.com": 0.70,
    # Académico (0.80)
    "scholar.google.com": 0.80,
    "jstor.org": 0.85,
    # Datos (0.80)
    "worldbank.org": 0.80,
    # Notebook (confianza máxima — el usuario lo subió)
    "NotebookLM": 1.0,
}

DEFAULT_TRUST = 0.50  # Dominio desconocido


def _get_trust_score(domain: str) -> float:
    """Busca la confiabilidad de un dominio, incluyendo subdominios."""
    domain_clean = domain.lower().replace("www.", "")
    for known, score in SOURCE_TRUST.items():
        if known in domain_clean:
            return score
    return DEFAULT_TRUST


# ═══════════════════════════════════════════════════════════════
# FEEDBACK REWARD CALCULATOR (Reinforcement-like signal)
# ═══════════════════════════════════════════════════════════════
def compute_feedback_rewards(
    sources: List[dict],
    feedback_history: List[dict],
) -> List[float]:
    """
    Computes a reward signal R ∈ [-1.0, 1.0] for each source based on
    the user's historical feedback actions.

    Logic:
    - If the source's domain was previously "inject"/"promote" → positive reward
    - If the source's domain was previously "delete" → negative reward
    - Keyword overlap with liked/disliked keywords modulates the signal
    """
    if not feedback_history:
        return [0.0] * len(sources)

    liked_domains: Set[str] = set()
    disliked_domains: Set[str] = set()
    liked_keywords: Set[str] = set()
    disliked_keywords: Set[str] = set()

    for entry in feedback_history:
        action = entry.get("action", "")
        domain = entry.get("domain", "").lower()
        keywords = set(entry.get("keywords", []))

        if action in ("inject", "promote"):
            liked_domains.add(domain)
            liked_keywords.update(keywords)
        elif action == "delete":
            disliked_domains.add(domain)
            disliked_keywords.update(keywords)

    rewards = []
    for src in sources:
        reward = 0.0
        src_domain = src.get("domain", "").lower()
        src_text = f"{src.get('title', '')} {src.get('snippet', '')}".lower()
        src_words = set(src_text.split())

        # Domain signal (strong)
        if src_domain in liked_domains:
            reward += 0.4
        if src_domain in disliked_domains:
            reward -= 0.6  # Asymmetric: rejection is a stronger signal

        # Keyword overlap signal (lighter)
        liked_overlap = len(src_words & liked_keywords)
        disliked_overlap = len(src_words & disliked_keywords)

        if liked_overlap > 0:
            reward += min(0.3, liked_overlap * 0.05)
        if disliked_overlap > 0:
            reward -= min(0.4, disliked_overlap * 0.07)

        rewards.append(max(-1.0, min(1.0, reward)))

    return rewards


# ═══════════════════════════════════════════════════════════════
# COSINE SIMILARITY (Lightweight — uses embedding service)
# ═══════════════════════════════════════════════════════════════
def _cosine_sim(a: List[float], b: List[float]) -> float:
    """Cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def compute_context_similarity(
    sources: List[dict],
    context_text: str,
) -> List[float]:
    """
    Computes cosine similarity between each source's text and the
    engineering context (.md file content).
    Returns list of scores ∈ [0.0, 1.0].
    
    Falls back to keyword overlap if embeddings are unavailable.
    """
    if not context_text or not sources:
        return [0.5] * len(sources)  # Neutral if no context

    try:
        from services.embedding_service import embedding_service  # type: ignore

        # Encode context once
        ctx_embedding = embedding_service.encode(context_text[:2000], prefix="consulta: ")[0]

        scores = []
        for src in sources:
            src_text = f"{src.get('title', '')} {src.get('snippet', '')}"
            if not src_text.strip():
                scores.append(0.0)
                continue
            src_embedding = embedding_service.encode(src_text[:500], prefix="pasaje: ")[0]
            sim = _cosine_sim(ctx_embedding, src_embedding)
            # Normalize to [0, 1] (cosine can be negative for multilingual models)
            scores.append(max(0.0, min(1.0, (sim + 1.0) / 2.0)))
        
        return scores

    except Exception as e:
        logfire.warning(f"Embedding fallback to keyword overlap: {e}")
        # Fallback: simple keyword overlap ratio
        ctx_words = set(context_text.lower().split())
        scores = []
        for src in sources:
            src_text = f"{src.get('title', '')} {src.get('snippet', '')}".lower()
            src_words = set(src_text.split())
            if not src_words:
                scores.append(0.0)
                continue
            overlap = len(ctx_words & src_words)
            scores.append(min(1.0, overlap / max(1, len(src_words) * 0.3)))
        return scores


# ═══════════════════════════════════════════════════════════════
# REDUNDANCY PENALTY (Dynamic Programming — Knapsack Diversity)
# ═══════════════════════════════════════════════════════════════
def compute_redundancy_penalties(
    sources: List[dict],
) -> List[float]:
    """
    Greedy diversity penalty using pairwise keyword overlap.
    Sources that cover the same ground as higher-ranked sources
    get penalized progressively.
    
    Uses a simplified "greedy knapsack" approach:
    - Process sources in order
    - Each source's penalty increases if its keywords overlap
      significantly with already-selected sources
    """
    if len(sources) <= 1:
        return [0.0] * len(sources)

    # Build keyword sets for each source
    keyword_sets: List[Set[str]] = []
    for src in sources:
        text = f"{src.get('title', '')} {src.get('snippet', '')}".lower()
        # Filter stopwords (< 4 chars) and build unique word set
        words = {w for w in text.split() if len(w) > 4}
        keyword_sets.append(words)

    penalties = [0.0] * len(sources)
    covered_keywords: Set[str] = set()

    for i, kw_set in enumerate(keyword_sets):
        if not kw_set:
            continue
        
        # What fraction of this source's keywords are already covered?
        if covered_keywords:
            overlap_ratio = len(kw_set & covered_keywords) / len(kw_set)
        else:
            overlap_ratio = 0.0
        
        # Penalty scales quadratically with overlap (harsh on near-duplicates)
        penalties[i] = overlap_ratio ** 1.5
        
        # Add this source's keywords to the "covered" pool
        covered_keywords.update(kw_set)

    return penalties


# ═══════════════════════════════════════════════════════════════
# ACTIVE LEARNING: UNCERTAINTY/GAP QUESTION GENERATOR
# ═══════════════════════════════════════════════════════════════
def detect_uncertainty_questions(
    sources: List[dict],
    context_similarity: List[float],
    quality_scores: List[float],
    gaps: List[str],
) -> List[Dict[str, str]]:
    """
    Generates "Active Learning" questions when the algorithm detects
    ambiguity or conflicting signals that require human clarification.
    
    Triggers:
    1. High-quality source with LOW context similarity → direction mismatch
    2. Large gap between top and bottom scores → possible bias
    3. Explicit gaps identified by the LLM refiner
    """
    questions: List[Dict[str, str]] = []

    # Trigger 1: Direction mismatch (good source but doesn't match context)
    for i, src in enumerate(sources):
        if i >= len(context_similarity) or i >= len(quality_scores):
            break
        if quality_scores[i] >= 7.0 and context_similarity[i] < 0.3:
            questions.append({
                "type": "direction_mismatch",
                "question": f"La fuente '{src.get('title', '?')}' ({src.get('domain', '?')}) tiene alta calidad pero se aparta de tu enfoque de investigación. ¿Quieres que la integre de todos modos, o la descarto para mantener el foco?",
                "source_index": str(i),
            })
            if len(questions) >= 2:
                break  # Don't overwhelm with questions

    # Trigger 2: Score spread is too wide
    if quality_scores and len(quality_scores) >= 4:
        top = max(quality_scores)
        bottom = min(quality_scores)
        if top - bottom >= 6:
            questions.append({
                "type": "quality_spread",
                "question": f"Hay una diferencia muy grande entre las fuentes de mayor y menor calidad (spread de {top - bottom} puntos). ¿Quieres que elimine automáticamente las fuentes con puntuación menor a 4?",
            })

    # Trigger 3: Explicit gaps from the LLM
    if gaps:
        gap_list = ", ".join(gaps[:3])
        questions.append({
            "type": "coverage_gap",
            "question": f"He detectado lagunas en la investigación: {gap_list}. ¿Quieres que lance una búsqueda adicional para cubrir estos temas?",
            "suggested_topics": gaps[:3],
        })

    return questions[:3]  # Max 3 questions per cycle


# ═══════════════════════════════════════════════════════════════
# MASTER SCORING FUNCTION
# ═══════════════════════════════════════════════════════════════
def compute_utility_scores(
    sources: List[dict],
    context_text: str = "",
    feedback_history: Optional[List[dict]] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Tuple[List[float], Dict[str, List[float]]]:
    """
    Master scoring function. Computes the final utility U for each source.
    
    U = (α · S_context) + (β · R_feedback) + (γ · I_source) - (δ · P_redundancy)
    
    Returns:
        - final_scores: List[float] — utility per source
        - breakdown: Dict with individual component scores for transparency
    """
    n = len(sources)
    if n == 0:
        return [], {}

    # Default weights (can be dynamically adjusted by user answers)
    w = weights or {
        "alpha": 0.35,   # Context similarity weight
        "beta": 0.25,    # Feedback reward weight
        "gamma": 0.20,   # Source reliability weight
        "delta": 0.20,   # Redundancy penalty weight
    }

    # 1. Context Similarity (S_context)
    s_context = compute_context_similarity(sources, context_text)

    # 2. Feedback Reward (R_feedback)
    r_feedback = compute_feedback_rewards(sources, feedback_history or [])

    # 3. Source Reliability (I_source)
    i_source = [_get_trust_score(src.get("domain", "")) for src in sources]

    # 4. Redundancy Penalty (P_redundancy) — computed on current order
    p_redundancy = compute_redundancy_penalties(sources)

    # Compute final utility
    final_scores = []
    for j in range(n):
        u = (
            w["alpha"] * s_context[j]
            + w["beta"] * (r_feedback[j] + 1.0) / 2.0  # Normalize [-1,1] → [0,1]
            + w["gamma"] * i_source[j]
            - w["delta"] * p_redundancy[j]
        )
        final_scores.append(round(u, 4))

    breakdown = {
        "context_similarity": [round(x, 3) for x in s_context],
        "feedback_reward": [round(x, 3) for x in r_feedback],
        "source_reliability": [round(x, 3) for x in i_source],
        "redundancy_penalty": [round(x, 3) for x in p_redundancy],
    }

    return final_scores, breakdown
