
# pyre-ignore[21]
import redis
import json
import hashlib
from typing import Optional
# pyre-ignore[21]
import logfire
# pyre-ignore[21]
from services.knowledge_base import knowledge_base

class SemanticCache:
    def __init__(self, host="localhost", port=6379, db=0):
        try:
            # Detectar IP de WSL si estamos en Windows
            import os
            self.redis_url = os.getenv("REDIS_URL", f"redis://{host}:{port}")
            self.client = redis.from_url(self.redis_url, decode_responses=True)
            logfire.info(f"Conectado a Redis para Cache Semántico: {self.redis_url}")
        except Exception as e:
            logfire.error(f"Error conectando a Redis: {e}")
            self.client = None

    def _get_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def get(self, prompt: str) -> Optional[str]:
        if not self.client:
            return None

        # 1. Intento de Match Exacto (Speed 1ms)
        try:
            cache_key = f"cache:exact:{self._get_hash(prompt)}"
            exact_match = self.client.get(cache_key)
            if exact_match:
                logfire.info("Cache Hit: Match Exacto en Redis")
                return exact_match
        except Exception:
            self.client = None  # Redis caído, deshabilitar
            return None

        # 2. Intento de Match Semántico (Speed 50-100ms)
        try:
            # Usamos ChromaDB para encontrar el prompt más parecido
            # El knowledge_base ya tiene el modelo de embeddings cargado
            results = knowledge_base.search_cache(prompt, limit=1)
            if results and results[0]['score'] > 0.96: # Umbral alto para evitar alucinaciones
                logfire.info(f"Cache Hit: Match Semántico ({results[0]['score']:.2f})")
                return results[0]['text']
        except Exception as e:
            logfire.warning(f"Error en búsqueda semántica de cache: {e}")

        return None

    def set(self, prompt: str, response: str):
        if not self.client:
            return

        # Guardar en Redis para match exacto
        try:
            cache_key = f"cache:exact:{self._get_hash(prompt)}"
            self.client.setex(cache_key, 3600 * 24, response) # Expira en 24h
        except Exception:
            self.client = None  # Redis caído, deshabilitar

        # Guardar en ChromaDB para match semántico
        try:
            knowledge_base.add_to_cache(prompt, response)
        except Exception as e:
            logfire.warning(f"Error guardando en cache semántico: {e}")

semantic_cache = SemanticCache()
