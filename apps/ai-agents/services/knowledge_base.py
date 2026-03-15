# pyre-ignore-all-errors
import os
import json
import chromadb
from pathlib import Path
from typing import List, Dict, Any, Optional
from services.embedding_service import embedding_service
import trafilatura
import logfire

class ChromaKnowledgeBase:
    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / "data"
        self.db_path = self.data_dir / "chroma_db"
        
        # 1. Inicializar Cliente Chroma (Persistente)
        self.client = chromadb.PersistentClient(path=str(self.db_path))
        
        # 2. El modelo de embeddings ahora se maneja vía Microservicio (Singleton)
        self.embedder = embedding_service
        
        # 3. Crear o recuperar colecciones
        # treaties: Los documentos base de la ONU
        # permanent_memory: El conocimiento extraído de la web
        self.treaties_coll = self.client.get_or_create_collection(
            name="un_treaties",
            metadata={"description": "Official UN treaties and legal documents"}
        )
        self.memory_coll = self.client.get_or_create_collection(
            name="permanent_memory",
            metadata={"description": "Cleaned web research knowledge"}
        )
        self.cache_coll = self.client.get_or_create_collection(
            name="llm_cache",
            metadata={"description": "Semantic cache for LLM responses"}
        )
        
        # Comprobar si necesitamos indexar los tratados por primera vez
        if self.treaties_coll.count() == 0:
            logfire.info("ChromaDB Treaties collection empty. Indexing static JSONs...")
            self._load_static_treaties()

    def _load_static_treaties(self):
        """Indexa los archivos JSON de tratados en ChromaDB."""
        for file_path in self.data_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    title = doc.get("title", "Documento")
                    articles = doc.get("articles", [])
                    
                    documents = []
                    metadatas = []
                    ids = []
                    
                    for art in articles:
                        text = art.get("text", "")
                        art_id = str(art.get("id", "?"))
                        
                        full_text = f"[{title} - Art. {art_id}]: {text}"
                        documents.append(full_text)
                        metadatas.append({"treaty": title, "article_id": art_id, "type": "legal"})
                        ids.append(f"{title}_{art_id}")

                    if documents:
                        # Generar embeddings usando el microservicio
                        embeddings = self.embedder.encode(documents, prefix="pasaje: ")
                        self.treaties_coll.add(
                            embeddings=embeddings,
                            documents=documents,
                            metadatas=metadatas,
                            ids=ids
                        )
            except Exception as e:
                logfire.error(f"Error indexing treaty {file_path.name}: {e}")

    def add_web_knowledge(self, url: str, raw_content: str):
        """Limpia la URL de 'trash content' usando Trafilatura e indexa en memoria permanente."""
        logfire.info(f"Indexing web knowledge from: {url}")
        
        # 1. Limpieza Profesional (Trafilatura extrae solo el cuerpo del artículo)
        downloaded = trafilatura.extract(raw_content, include_comments=False, include_tables=True)
        
        if not downloaded or len(downloaded) < 100:
            logfire.warning(f"Trafilatura failed or content too short for {url}. Skipping.")
            return

        # 2. Chunking simple (Chroma funciona mejor con fragmentos de tamaño medio)
        # Dividimos en párrafos o bloques de ~1000 chars
        chunks = [downloaded[i:i+1500] for i in range(0, len(downloaded), 1500)]
        
        for idx, chunk in enumerate(chunks):
            embedding = self.embedder.encode(chunk, prefix="pasaje: ")
            doc_id = f"web_{hash(url)}_{idx}"
            
            self.memory_coll.add(
                embeddings=embedding,
                documents=[chunk],
                metadatas=[{"url": url, "source": "Web Research", "chunk": idx}],
                ids=[doc_id]
            )
        
        logfire.info(f"Successfully indexed {len(chunks)} cleaned chunks from {url}")

    def search_structured(self, query: str, top_k: int = 12):
        """Busca en AMBAS colecciones y retorna resultados unificados con Scoring Híbrido."""
        query_emb = self.embedder.encode(query, prefix="query: ")
        query_words = set(query.lower().split())
        
        # Buscar en tratados
        treaty_res = self.treaties_coll.query(
            query_embeddings=query_emb,
            n_results=top_k * 2 # Traemos más para el re-ranking
        )
        
        # Buscar en memoria permanente
        memory_res = self.memory_coll.query(
            query_embeddings=query_emb,
            n_results=min(5, top_k)
        )
        
        results = []
        
        # Unión de resultados
        to_process = []
        for i in range(len(treaty_res['documents'][0])):
            to_process.append({
                "text": treaty_res['documents'][0][i],
                "meta": treaty_res['metadatas'][0][i],
                "dist": treaty_res['distances'][0][i],
                "type": "legal"
            })
            
        for i in range(len(memory_res['documents'][0])):
            to_process.append({
                "text": memory_res['documents'][0][i],
                "meta": memory_res['metadatas'][0][i],
                "dist": memory_res['distances'][0][i],
                "type": "web"
            })

        for item in to_process:
            text = item["text"]
            meta = item["meta"]
            
            # 1. Score Semántico (Invertimos L2: 0 es mejor, 2 es peor)
            # Normalizamos aprox: 1.0 (perfecto) a 0.0
            sem_score = max(0, 1 - (item["dist"] / 1.5))
            
            # 2. Score de Palabras Clave (Hybrid)
            text_words = set(text.lower().replace('[', ' ').replace(']', ' ').split())
            overlap = len(query_words.intersection(text_words))
            key_score = min(1.0, overlap / (len(query_words) + 1) * 2) # Bonus por coincidencia léxica
            
            # Score Final Híbrido (70% semántica, 30% palabras clave)
            final_score = (sem_score * 0.7) + (key_score * 0.3)
            
            # Filtro administrativo (ruido en la Carta de la ONU)
            if item["type"] == "legal" and "Carta" in str(meta['treaty']):
                art_id = str(meta['article_id'])
                if art_id.isdigit() and 5 <= int(art_id) <= 11 and art_id not in query:
                    continue

            results.append({
                "score": final_score,
                "treaty": meta['treaty'] if item["type"] == "legal" else meta['url'],
                "id": meta['article_id'] if item["type"] == "legal" else "INVESTIGACIÓN",
                "text": text
            })

        # Ordenar por score (Mayor es mejor ahora)
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return results[:top_k]

    def search_cache(self, query: str, limit: int = 1):
        """Busca en el cache semántico."""
        query_emb = self.embedder.encode(query, prefix="query: ")
        res = self.cache_coll.query(
            query_embeddings=query_emb,
            n_results=limit
        )
        
        results = []
        for i in range(len(res['documents'][0])):
            # Convertir distancia L2 a score de similitud (estimado)
            # dist 0 = sim 1.0, dist 1.0 = sim 0.5 (aprox para E5)
            distance = res['distances'][0][i]
            score = max(0, 1 - (distance / 2))
            
            results.append({
                "score": score,
                "text": res['documents'][0][i]
            })
        return results

    def add_to_cache(self, prompt: str, response: str):
        """Guarda un prompt y su respuesta en el cache semántico."""
        embedding = self.embedder.encode(prompt, prefix="query: ")
        prompt_id = f"cache_{hash(prompt)}"
        self.cache_coll.add(
            embeddings=embedding,
            documents=[response],
            metadatas=[{"prompt": prompt[:200]}],
            ids=[prompt_id]
        )

# Singleton
knowledge_base = ChromaKnowledgeBase()
