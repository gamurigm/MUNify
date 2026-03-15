
import sys
import os
import asyncio
from pathlib import Path
import time

# Añadir el path actual para importar los servicios
sys.path.append(str(Path(__file__).parent))

from services.llm import fast_llm
from services.semantic_cache import semantic_cache
from langchain_core.messages import HumanMessage

async def benchmark_optimization():
    print("🚀 INICIANDO BENCHMARK DE OPTIMIZACIÓN\n")
    
    prompt = "Explica la importancia del Tratado de No Proliferación Nuclear en 3 puntos."
    messages = [HumanMessage(content=prompt)]

    # 1. Primera llamada (Debe ir a la API)
    print("--- Ronda 1: Llamada Directa a API ---")
    start_time = time.time()
    response1 = await fast_llm.ainvoke(messages)
    end_time = time.time()
    print(f"⏱️ Tiempo Ronda 1: {end_time - start_time:.2f}s")
    print(f"📄 Respuesta (primeros 50 chars): {response1.content[:50]}...")

    # 2. Segunda llamada (Debe ser CACHE HIT)
    print("\n--- Ronda 2: Misma consulta (Cache Hit Redis) ---")
    start_time = time.time()
    response2 = await fast_llm.ainvoke(messages)
    end_time = time.time()
    print(f"⏱️ Tiempo Ronda 2: {end_time - start_time:.2f}s")
    
    if end_time - start_time < 0.2:
        print("✅ ÉXITO: Cache Hit ultra-rápido detectado.")
    else:
        print("❌ FALLO: El tiempo es demasiado alto para un cache hit.")

    # 3. Test de Streaming
    print("\n--- Ronda 3: Test de Streaming ---")
    print("Tokens recibidos: ", end="", flush=True)
    async for chunk in fast_llm.astream(messages):
        print(f"[{chunk.content}]", end="", flush=True)
    print("\n✅ ÉXITO: Streaming verificado.")

if __name__ == "__main__":
    asyncio.run(benchmark_optimization())
