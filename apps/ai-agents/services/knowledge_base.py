# pyre-ignore-all-errors
import os
import json
from pathlib import Path

# Base de conocimiento Profesional MUNify
class KnowledgeBaseService:
    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / "data"
        self.documents = []
        self._load_databases()

    def _load_databases(self):
        """Carga todas las bases de datos JSON de tratados en memoria."""
        if not self.data_dir.exists():
            return

        for file_path in self.data_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    self.documents.append(doc)
            except Exception as e:
                print(f"Error loading {file_path.name}: {e}")

    def search(self, query: str):
        """Busca fragmentos relevantes basados en palabras clave."""
        from typing import List, Dict, Any
        results: List[Dict[str, Any]] = []
        query_lower = query.lower()
        search_terms = query_lower.split()
        
        # Filtrar términos muy comunes (stopwords básicos) para no contaminar la búsqueda
        stopwords = {"de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "del", "por", "para", "con"}
        keywords = [word for word in search_terms if word not in stopwords and len(word) > 3]
        
        if not keywords:
            # Si no hay palabras clave útiles, devolver los principios de la Carta ONU por defecto
            return self._get_default_fallback()

        for doc in self.documents:
            title = doc.get("title", "Documento Oficial")
            articles: List[Dict[str, Any]] = doc.get("articles", []) # pyre-ignore
            for article in articles:
                text = article.get("text", "")
                text_lower = text.lower()
                
                # Búsqueda por coincidencia de palabras clave
                match_score = sum(1 for word in keywords if word in text_lower)
                
                if match_score > 0:
                    results.append({
                        "score": match_score,
                        "text": f"[{title} - Artículo {article.get('id', '?')}]: {text}"
                    })
        
        if not results:
            return self._get_default_fallback()
            
        # Ordenar por relevancia (coincidencias de palabras clave) y devolver los mejores 8
        results.sort(key=lambda x: x["score"], reverse=True)
        return [res["text"] for res in results[:8]] # pyre-ignore

    def search_structured(self, query: str):
        """Returns raw article dicts: [{treaty, id, text, score}]"""
        from typing import List, Dict, Any
        results: List[Dict[str, Any]] = []
        query_lower = query.lower()
        search_terms = query_lower.split()
        stopwords = {"de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "del", "por", "para", "con", "que", "se", "es"}
        keywords = [word for word in search_terms if word not in stopwords and len(word) > 2]
        
        if not keywords:
            return []

        for doc in self.documents:
            title = doc.get("title", "Documento Oficial")
            articles: List[Dict[str, Any]] = doc.get("articles", []) # pyre-ignore
            for article in articles:
                text = article.get("text", "")
                text_lower = text.lower()
                match_score = sum(1 for word in keywords if word in text_lower)
                if match_score > 0:
                    results.append({
                        "score": match_score,
                        "treaty": title,
                        "id": article.get("id", "?"),
                        "text": text
                    })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:8]  # pyre-ignore

    def _get_default_fallback(self):
        """Fallback diplomático genérico si la búsqueda falla."""
        from typing import List, Dict, Any
        # Se asegura de siempre inyectar al menos el Art. 1 y 2 de la Carta o de los DDHH si se cargaron
        for doc in self.documents:
            if "Carta" in doc.get("title", ""):
                articles: List[Dict[str, Any]] = doc.get("articles", []) # pyre-ignore
                return [f"[{doc['title']} - Artículo {art['id']}]: {art['text']}" for art in articles[:2]]
        
        return [
            "Carta de las Naciones Unidas, Artículo 1: Mantener la paz y la seguridad internacionales.",
            "Carta de las Naciones Unidas, Artículo 2: Igualdad soberana de todos sus Miembros."
        ]

knowledge_base = KnowledgeBaseService()

