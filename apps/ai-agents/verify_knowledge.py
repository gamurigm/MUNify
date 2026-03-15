
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from services.knowledge_base import knowledge_base
import json

def test_semantic_search():
    # Prueba 1: Búsqueda Semántica sobre los tratados
    query1 = "principios de paz y seguridad"
    print(f"\n🔍 Probando Búsqueda Semántica: '{query1}'")
    results1 = knowledge_base.search_structured(query1, top_k=3)
    for r in results1:
        print(f"[{r['score']:.2f}] {r['treaty']} - Art. {r['id']}: {r['text'][:100]}...")

    # Prueba 2: Búsqueda sobre el conocimiento permanente guardado (Web)
    query2 = "crisis alimentaria mundial nutrición"
    print(f"\n🔍 Probando Memoria Permanente (Web): '{query2}'")
    results2 = knowledge_base.search_structured(query2, top_k=3)
    for r in results2:
        print(f"[{r['score']:.2f}] Fuente: {r['treaty']} - {r['text'][:150]}...")

if __name__ == "__main__":
    test_semantic_search()
