import json
import hashlib
from typing import Optional
import logfire
from services.knowledge_base import knowledge_base

# In-memory dictionary for exact caching (replaces Redis)
_EXACT_CACHE = {}

class SemanticCache:
    def __init__(self):
        logfire.info("Iniciando SemanticCache (In-Memory + ChromaDB)")

    def _get_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def get(self, prompt: str) -> Optional[str]:
        # 1. Intento de Match Exacto (Speed 1ms)
        cache_key = self._get_hash(prompt)
        exact_match = _EXACT_CACHE.get(cache_key)
        if exact_match:
            logfire.info("Cache Hit: Match Exacto en Memoria")
            return exact_match

        # 2. Intento de Match Semántico (Speed 50-100ms)
        try:
            # Usamos ChromaDB para encontrar el prompt más parecido
            results = knowledge_base.search_cache(prompt, limit=1)
            if results and results[0]['score'] > 0.96: # Umbral alto para evitar alucinaciones
                logfire.info(f"Cache Hit: Match Semántico ({results[0]['score']:.2f})")
                return results[0]['text']
        except Exception as e:
            logfire.warning(f"Error en búsqueda semántica de cache: {e}")

        return None

    def set(self, prompt: str, response: str):
        # Guardar en memoria para match exacto
        cache_key = self._get_hash(prompt)
        _EXACT_CACHE[cache_key] = response

        # Guardar en ChromaDB para match semántico
        try:
            knowledge_base.add_to_cache(prompt, response)
        except Exception as e:
            logfire.warning(f"Error guardando en cache semántico: {e}")

# Maintain the .client attribute just in case any other part of the codebase 
# awkwardly references semantic_cache.client. It can just be None.
class _DummyClient:
    pass

semantic_cache = SemanticCache()
semantic_cache.client = _DummyClient()
