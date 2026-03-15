
import asyncio
import time
import requests
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from pathlib import Path
import json

# Lista de URLs de prueba (Simulando fuentes confiables sobre MUN/Derechos Humanos/Geopolítica)
TEST_URLS = [
    "https://www.un.org/es/about-us/un-charter/full-text",
    "https://www.ohchr.org/es/instruments-mechanisms/instruments/universal-declaration-human-rights",
    "https://www.icrc.org/es/doc/war-and-law/treaties-customary-law/geneva-conventions/overview-geneva-conventions.htm",
    "https://es.wikipedia.org/wiki/Naciones_Unidas",
    "https://es.wikipedia.org/wiki/Derecho_internacional_humanitario",
    "https://www.amnesty.org/es/what-we-do/universal-declaration-of-human-rights/",
    "https://www.hrw.org/es/news/2023/12/08/la-declaracion-universal-de-derechos-humanos-los-75",
    "https://www.unicef.org/es/convencion-derechos-nino/texto-convencion",
    "https://www.casareal.es/ES/Actividades/Paginas/actividades_actividades_detalle.aspx?data=15886", # Ejemplo de sitio con estructura distinta
    "https://www.exteriores.gob.es/es/PoliticaExterior/Paginas/NacionesUnidas.aspx"
]

class IndexingSTRESS:
    def __init__(self):
        print("Cargando modelo de vectorización...")
        self.model = SentenceTransformer('intfloat/multilingual-e5-small')
        self.dimension = 384
        self.index = faiss.IndexFlatL2(self.dimension)
        self.metadata = []

    def clean_text(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        # Eliminar scripts y estilos
        for script in soup(["script", "style"]):
            script.decompose()
        text = soup.get_text()
        # Limpiar espacios en blanco
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        return "\n".join(chunk for chunk in chunks if chunk)

    async def stress_test(self):
        results = []
        total_start = time.time()
        
        print(f"\n🚀 Iniciando Prueba de Estrés de Indexado Semántico ({len(TEST_URLS)} sitios)")
        print("-" * 60)

        for url in TEST_URLS:
            start_time = time.time()
            try:
                print(f"📥 Descargando: {url}...")
                response = requests.get(url, timeout=10)
                html_content = response.text
                
                # 1. Limpieza de Contenido
                cleaned_text = self.clean_text(html_content)
                char_count = len(cleaned_text)
                
                # 2. Chunking (Dividir en fragmentos para vectorizar)
                # Simulamos fragmentos de ~1000 caracteres
                chunks = [cleaned_text[i:i+1000] for i in range(0, char_count, 1000)]
                
                # 3. Vectorización Semántica
                print(f"🧠 Vectorizando {len(chunks)} fragmentos...")
                embeddings = self.model.encode([f"pasaje: {c}" for c in chunks], convert_to_numpy=True)
                
                # 4. Inserción en FAISS
                self.index.add(embeddings)
                
                elapsed = time.time() - start_time
                print(f"✅ Éxito: {char_count} caracteres indexados en {elapsed:.2f}s")
                
                results.append({
                    "url": url,
                    "status": "success",
                    "chars": char_count,
                    "chunks": len(chunks),
                    "time": elapsed
                })
            except Exception as e:
                print(f"❌ Error en {url}: {e}")
                results.append({"url": url, "status": "error", "error": str(e)})

        total_elapsed = time.time() - total_start
        self.report(results, total_elapsed)

    def report(self, results, total_time):
        successes = [r for r in results if r['status'] == 'success']
        total_chars = sum(r['chars'] for r in successes)
        total_chunks = sum(r['chunks'] for r in successes)
        
        print("\n" + "=" * 60)
        print("📊 REPORTE FINAL DE CAPACIDAD DE INDEXADO")
        print("=" * 60)
        print(f"⏱️ Tiempo total: {total_time:.2f} segundos")
        print(f"✅ Sitios procesados con éxito: {len(successes)}/{len(TEST_URLS)}")
        print(f"📝 Total caracteres indexados: {total_chars:,}")
        print(f"🧩 Total vectores (embeddings) generados: {total_chunks}")
        print(f"⚡ Velocidad promedio: {total_chars/total_time:.2f} caracteres/seg")
        print(f"💾 Memoria estimada en FAISS: {(total_chunks * self.dimension * 4) / 1024:.2f} KB")
        print("-" * 60)
        
        if successes:
            print("\nTop Sitio más pesado:")
            heaviest = max(successes, key=lambda x: x['chars'])
            print(f"  - {heaviest['url']} ({heaviest['chars']:,} caracteres)")

if __name__ == "__main__":
    # Asegurarse de que bs4 esté instalado
    try:
        import bs4
    except ImportError:
        import subprocess
        subprocess.run(["pip", "install", "beautifulsoup4"])
    
    tester = IndexingSTRESS()
    asyncio.run(tester.stress_test())
