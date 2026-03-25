# pyre-ignore-all-errors
import os
import random
import time
# pyre-ignore[21]
from tavily import TavilyClient
# pyre-ignore[21]
from langchain_nvidia_ai_endpoints import ChatNVIDIA
# pyre-ignore[21]
import logfire

# The environment is loaded in main.py, but we can ensure it here
# pyre-ignore[21]
from dotenv import load_dotenv
from pathlib import Path
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# 🔑 Inicialización de Clientes
try:
    tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY", "tvly-placeholder1234567890"))
except Exception:
    class TavilyMock:
        def search(self, **kwargs): return {"results": []}
    tavily = TavilyMock()
    logfire.warning("Tavily API Key no válida o faltante. Usando buscador simulado (sin resultados).")

# 🔑 Carga de múltiples llaves para Performance/Redundancia
NVIDIA_KEYS = [
    os.getenv("NVIDIA_API_KEY_1"),
    os.getenv("NVIDIA_API_KEY_2"),
    os.getenv("NVIDIA_API_KEY_3"),
    os.getenv("NVIDIA_API_KEY_4"),
    os.getenv("NVIDIA_API_KEY_5")
]

def get_random_key():
    valid_keys = [k for k in NVIDIA_KEYS if k]
    return random.choice(valid_keys) if valid_keys else None

# pyre-ignore[21]
from services.semantic_cache import semantic_cache
# pyre-ignore[21]
from services.telemetry import telemetry
# pyre-ignore[21]
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from typing import List, Union, Optional

class CachedLLM:
    def __init__(self, llm: ChatNVIDIA, name: str):
        self.llm = llm
        self.name = name

    async def ainvoke(self, input: Union[str, List[BaseMessage]], config: Optional[dict] = None, **kwargs):
        # 1. Preparar el prompt para el cache
        if isinstance(input, str):
            prompt = input
        else:
            # Unificar historial de mensajes en un solo string para el hash
            prompt = "\n".join([f"{m.type}: {m.content}" for m in input])

        # 2. Intentar obtener del cache
        cached_response = semantic_cache.get(prompt)
        if cached_response:
            telemetry.track_cache(hit=True)
            logfire.info(f"LLM {self.name}: Usando respuesta de CACHE.")
            
            # Estimar tokens de cache (aprox 4 caracteres por token)
            in_tokens = len(prompt) // 4
            out_tokens = len(cached_response) // 4
            telemetry.track_call(f"{self.name}_cached", 0.05, in_tokens, out_tokens)
            
            # pyre-ignore[21]
            from langchain_core.messages import AIMessage
            return AIMessage(content=cached_response)

        # 3. Si no está en cache, llamar al modelo real
        telemetry.track_cache(hit=False)
        logfire.info(f"LLM {self.name}: Llamando a API de NVIDIA...")
        start = time.time()
        response = await self.llm.ainvoke(input, config=config, **kwargs)
        duration = time.time() - start
        
        # 4. Guardar en cache y registrar telemetría
        if response and hasattr(response, 'content'):
            content = str(getattr(response, 'content'))
            semantic_cache.set(prompt, content)
            
            # Extraer tokens si están disponibles en metadata
            # LangChain ChatNVIDIA suele ponerlo en response_metadata
            usage = getattr(response, 'response_metadata', {}).get('token_usage', {})
            in_tokens = usage.get('prompt_tokens', len(prompt) // 4)
            out_tokens = usage.get('completion_tokens', len(content) // 4)
            
            telemetry.track_call(self.name, duration, in_tokens, out_tokens)
        
        return response

    async def astream(self, input: Union[str, List[BaseMessage]], config: Optional[dict] = None, **kwargs):
        # Preparar prompt para el cache
        if isinstance(input, str):
            prompt = input
        else:
            prompt = "\n".join([f"{m.type}: {m.content}" for m in input])

        # Verificamos si está en cache
        cached_response = semantic_cache.get(prompt)
        if cached_response:
            logfire.info(f"LLM {self.name}: Stream usando CACHE.")
            # Si hay cache, lo enviamos en un bloque simulando un chunk
            # pyre-ignore[21]
            from langchain_core.messages import AIMessageChunk
            yield AIMessageChunk(content=cached_response)
            return

        # Si no hay cache, streameamos de la API
        logfire.info(f"LLM {self.name}: Iniciando STREAM desde NVIDIA...")
        full_content = []
        async for chunk in self.llm.astream(input, config=config, **kwargs):
            if chunk.content:
                full_content.append(chunk.content)
            yield chunk
        
        # Guardar resultado final en cache
        if full_content:
            semantic_cache.set(prompt, "".join(full_content))

# 🔑 Inicialización de modelos NVIDIA NIM con Cache Semántico
_api_key = get_random_key()

_scribe = ChatNVIDIA(
    model="nvidia/nemotron-3-super-120b-a12b",
    api_key=_api_key,
    temperature=0.6,
    max_tokens=4000
)

_critic = ChatNVIDIA(
    model="nvidia/nemotron-3-super-120b-a12b",
    api_key=_api_key,
    temperature=0.1,
    max_tokens=2048
)

_fast = ChatNVIDIA(
    model="nvidia/nemotron-3-super-120b-a12b",
    api_key=_api_key,
    temperature=0.1
)

# Exportamos los wrappers
scribe_llm = CachedLLM(_scribe, "Scribe")
critic_llm = CachedLLM(_critic, "Critic")
fast_llm = CachedLLM(_fast, "Fast/Chat")
