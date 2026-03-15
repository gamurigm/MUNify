
import sys
import os
import requests
from pathlib import Path

# Añadir el path actual para importar los servicios
sys.path.append(str(Path(__file__).parent))

from services.knowledge_base import knowledge_base
import logfire

# 5 URLs Aprobadas por el Usuario (Alta Calidad / Deep Research)
APPROVED_URLS = [
    "https://www.sipri.org/research",
    "https://www.crisisgroup.org/visual-explainer/crisiswatch",
    "https://www.fao.org/publications/home/fao-flagship-publications/the-state-of-food-security-and-nutrition-in-the-world/es",
    "https://news.un.org/es/news/topic/peace-and-security",
    "https://www.iaea.org/es/temas/seguridad-fisica-nuclear"
]

def run_indexing():
    logfire.info("Iniciando indexado de fuentes aprobadas en ChromaDB...")
    
    for url in APPROVED_URLS:
        try:
            logfire.info(f"Procesando: {url}")
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                knowledge_base.add_web_knowledge(url, response.text)
                print(f"✅ Indexado con éxito: {url}")
            else:
                print(f"❌ Error {response.status_code} al acceder a {url}")
        except Exception as e:
            print(f"❌ Fallo crítico en {url}: {e}")

    print("\n--- RESUMEN CHROMADB ---")
    print(f"Tratados estáticos: {knowledge_base.treaties_coll.count()}")
    print(f"Memoria web permanente: {knowledge_base.memory_coll.count()}")

if __name__ == "__main__":
    run_indexing()
