# pyre-ignore-all-errors
import os
import json
import chromadb
from pathlib import Path
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import trafilatura
import logfire

class ChromaKnowledgeBase:
    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / "data"
        self.db_path = self.data_dir / "chroma_db"
        
        # 1. Inicializar Cliente Chroma (Persistente)
        self.client = chromadb.PersistentClient(path=str(self.db_path))
        
        # 2. Cargar el modelo de embeddings (E5 Multilingual)
        logfire.info("Loading Semantic Model: intfloat/multilingual-e5-small")
        self.model = SentenceTransformer('intfloat/multilingual-e5-small')
        
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
                        # Generar embeddings
                        embeddings = self.model.encode([f"pasaje: {d}" for d in documents]).tolist()
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
            embedding = self.model.encode([f"pasaje: {chunk}"]).tolist()
            doc_id = f"web_{hash(url)}_{idx}"
            
            self.memory_coll.add(
                embeddings=embedding,
                documents=[chunk],
                metadatas=[{"url": url, "source": "Web Research", "chunk": idx}],
                ids=[doc_id]
            )
        
        logfire.info(f"Successfully indexed {len(chunks)} cleaned chunks from {url}")

    def search_structured(self, query: str, top_k: int = 8):
        """Busca en AMBAS colecciones y retorna resultados unificados."""
        query_emb = self.model.encode([f"query: {query}"]).tolist()
        
        # Buscar en tratados
        treaty_res = self.treaties_coll.query(
            query_embeddings=query_emb,
            n_results=top_k
        )
        
        # Buscar en memoria permanente
        memory_res = self.memory_coll.query(
            query_embeddings=query_emb,
            n_results=min(3, top_k) # Damos menos peso inicial a la memoria web
        )
        
        results = []
        
        # Procesar tratados
        for i in range(len(treaty_res['documents'][0])):
            doc_text = treaty_res['documents'][0][i]
            meta = treaty_res['metadatas'][0][i]
            
            # Filtro administrativo (ruido)
            if "Carta" in str(meta['treaty']) and str(meta['article_id']).isdigit():
                art_num = int(meta['article_id'])
                if 5 <= art_num <= 11 and str(art_num) not in query:
                    continue

            results.append({
                "score": treaty_res['distances'][0][i],
                "treaty": meta['treaty'],
                "id": meta['article_id'],
                "text": doc_text
            })

        # Procesar memoria permanente
        for i in range(len(memory_res['documents'][0])):
            results.append({
                "score": memory_res['distances'][0][i],
                "treaty": memory_res['metadatas'][0][i]['url'],
                "id": "INVESTIGACIÓN",
                "text": memory_res['documents'][0][i]
            })

        # Ordenar por distancia (Chroma usa L2 por defecto, menor es mejor)
        results.sort(key=lambda x: x["score"])
        
        return results[:top_k]

# Singleton
knowledge_base = ChromaKnowledgeBase()
