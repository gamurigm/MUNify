# pyre-ignore-all-errors
from notebooklm import NotebookLMClient
import os
import asyncio
from typing import List, Optional, Any, Dict
import logfire # pyre-ignore

class NotebookLMService:
    def __init__(self) -> None:
        home_dir = os.getenv("NOTEBOOKLM_HOME") or os.path.expanduser("~/.notebooklm")
        self.storage_path: str = os.path.join(home_dir, "storage_state.json")
        self.client_ctx: Any = None
        self.client: Any = None
        self._lock = asyncio.Lock()
        self._refresh_task: Optional[asyncio.Task] = None

    async def ensure_client(self) -> None:
        """Inicialización proactiva del cliente para persistencia."""
        if self.client:
            return
        
        async with self._lock:
            if self.client:
                return
            
            if not self.is_authenticated():
                logfire.warning("NotebookLM storage state not found. Manual 'notebooklm login' required.")
                return

            try:
                logfire.info("Iniciando conexión persistente con NotebookLM...")
                ctx_mgr = await NotebookLMClient.from_storage(self.storage_path)
                self.client_ctx = ctx_mgr
                self.client = await ctx_mgr.__aenter__()
                
                # Lanzar tarea de refresco en background para mantener sesión viva
                if not self._refresh_task or self._refresh_task.done():
                    self._refresh_task = asyncio.create_task(self._session_keep_alive())
                
                logfire.info("Conexión con NotebookLM establecida y persistente.")
            except Exception as e:
                logfire.error(f"Error en persistencia automática de NotebookLM: {e}")
                # Si falla por auth inicialmente, limpiar para permitir re-login
                if "302" in str(e) or "redirect" in str(e).lower():
                    # Llamar a version síncrona o interna si es necesario, 
                    # pero reset_auth es async y ya tenemos el lock.
                    # Para evitar deadlock con el lock ya tomado en async with self._lock:
                    self.client = None
                    self.client_ctx = None
                    if os.path.exists(self.storage_path):
                        try:
                            os.remove(self.storage_path)
                            logfire.info("Archivo corrupto eliminado durante inicialización.")
                        except:
                            pass
                else:
                    self.client = None
                    self.client_ctx = None

    async def _session_keep_alive(self) -> None:
        """Tarea para mantener la sesión viva mediante refresco periódico."""
        while self.client:
            try:
                await asyncio.sleep(3600) # Refrescar cada hora
                if self.client:
                    logfire.info("Refrescando sesión de NotebookLM...")
                    await self.client.refresh_auth()
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Si hay redundancia de error 302 o similar, la sesión expiró
                if "302" in str(e) or "redirect" in str(e).lower():
                    logfire.error(f"Sesión de NotebookLM expirada (302 Redirect). Requiere re-login: {e}")
                    await self.reset_auth()
                    break
                
                logfire.warning(f"Error refrescando sesión: {e}")
                await asyncio.sleep(60) # Reintentar pronto si falla

    async def reset_auth(self) -> None:
        """Limpia la sesión actual y elimina el archivo de estado para permitir re-login."""
        async with self._lock:
            logfire.info("Reseteando autenticación de NotebookLM...")
            
            # 1. Intentar cerrar el cliente si existe
            if self.client_ctx:
                try:
                    await self.client_ctx.__aexit__(None, None, None)
                except:
                    pass
            
            self.client = None
            self.client_ctx = None
            
            # 2. Cancelar tarea de refresco
            if self._refresh_task and not self._refresh_task.done():
                self._refresh_task.cancel()
                self._refresh_task = None

            # 3. Eliminar archivo de persistencia
            if os.path.exists(self.storage_path):
                try:
                    os.remove(self.storage_path)
                    logfire.info("Archivo storage_state.json eliminado correctamente.")
                except Exception as e:
                    logfire.error(f"No se pudo eliminar el archivo de sesión: {e}")

    def is_authenticated(self) -> bool:
        """Verifica si el archivo de autenticación existe."""
        return os.path.exists(self.storage_path)

    async def close(self) -> None:
        """Cierre ordenado del servicio."""
        if self.client_ctx:
            await self.client_ctx.__aexit__(None, None, None)
        if self._refresh_task:
            self._refresh_task.cancel()

    def is_ready(self) -> bool:
        """Verifica si el cliente está conectado y operable."""
        return self.client is not None

    async def get_client(self) -> Any:
        if not self.client:
            await self.ensure_client()
            
        if not self.client:
            raise Exception("NotebookLM no disponible. Verifique que 'notebooklm login' haya sido ejecutado.")
            
        return self.client

    @logfire.instrument("NotebookLM: Register Document")
    async def ingest_professional_context(self, notebook_title: str, file_paths: List[str]) -> str:
        """Crea un notebook y sube archivos PDF para contexto profesional."""
        client = await self.get_client()
        
        # 1. Crear o buscar notebook
        notebooks = await client.notebooks.list()
        target_nb = next((nb for nb in notebooks if nb.title == notebook_title), None)
        
        if not target_nb:
            target_nb = await client.notebooks.create(notebook_title)
            logfire.info(f"Notebook creado: {target_nb.id if target_nb else 'manual'}")
        
        nb_id: str = target_nb.id if target_nb else "unknown"
        
        # 2. Subir archivos
        uploaded_count = 0
        for path in file_paths:
            if os.path.exists(path):
                logfire.info(f"Subiendo fuente: {path}")
                await client.sources.add_file(nb_id, path, wait=True)
                uploaded_count += 1
        
        logfire.info(f"Ingesta completada: {uploaded_count}/{len(file_paths)} archivos subidos al notebook {nb_id}")
        return nb_id

    @logfire.instrument("NotebookLM: Append Sources")
    async def append_sources(self, notebook_id: str, file_paths: List[str]) -> int:
        """Añade archivos a un notebook existente. Retorna el número de archivos subidos."""
        client = await self.get_client()
        uploaded = 0
        for path in file_paths:
            if os.path.exists(path):
                logfire.info(f"Añadiendo fuente a {notebook_id}: {path}")
                await client.sources.add_file(notebook_id, path, wait=True)
                uploaded += 1
        return uploaded

    @logfire.instrument("NotebookLM: List Notebooks")
    async def list_notebooks(self) -> List[Dict[str, str]]:
        """Lista todos los notebooks disponibles."""
        client = await self.get_client()
        notebooks = await client.notebooks.list()
        result: List[Dict[str, str]] = []
        for nb in notebooks:
            result.append({
                "id": str(nb.id),
                "title": str(nb.title),
            })
        return result

    @logfire.instrument("NotebookLM: List Sources")
    async def list_sources(self, notebook_id: str) -> List[Dict[str, str]]:
        """Lista las fuentes de un notebook específico."""
        client = await self.get_client()
        # The notebooklm-py library provides source listing via the notebook
        try:
            notebooks = await client.notebooks.list()
            target_nb = next((nb for nb in notebooks if str(nb.id) == notebook_id), None)
            if not target_nb:
                return []
            
            sources = await client.sources.list(notebook_id)
            result: List[Dict[str, str]] = []
            for src in sources:
                result.append({
                    "id": str(getattr(src, 'id', '')),
                    "title": str(getattr(src, 'title', getattr(src, 'name', 'Unknown'))),
                    "type": str(getattr(src, 'type', 'file')),
                })
            return result
        except Exception as e:
            logfire.warning(f"Error listing sources for {notebook_id}: {e}")
            return []

    @logfire.instrument("NotebookLM: Query Context")
    async def query_notebook(self, notebook_id: str, prompt: str) -> Dict[str, Any]:
        """Consulta el contexto profesional ingerido y retorna respuesta con citas."""
        client = await self.get_client()
        result = await client.chat.ask(notebook_id, prompt)
        
        # Estructuramos las citas si existen para que el frontend las use como bibliografía
        citations = []
        
        # 1. Intentar obtener citas de metadatos (formato oficial de la API)
        if hasattr(result, 'citations') and result.citations:
            logfire.info(f"Metadatos de citas detectados: {len(result.citations)}")
            for cit in result.citations:
                citations.append({
                    "source_title": getattr(cit, 'source_title', 'Fuente desconocida'),
                    "text_segment": getattr(cit, 'text_segment', ''),
                    "page_number": getattr(cit, 'page_number', None)
                })
        
        # 2. PARSER SECUNDARIO (ROBUSTO): Si no hay metadatos, buscamos en el texto
        # Buscamos patrones típicos de citas textuales o referencias
        if result.answer:
            import re
            
            # Patrón A: Búsqueda de fragmentos entrecomillados seguidos de (Fuente, Año/Pág)
            # Ej: "El cambio climático es real" (IPCC, 2021)
            quotes_with_source = re.finditer(r'["“]([^"”]{10,})["”]\s*\(([^)]+)\)', result.answer)
            for match in quotes_with_source:
                text = match.group(1).strip()
                source_info = match.group(2)
                
                # Extraer página si existe (p. 23, pág 45, etc)
                page_match = re.search(r'(?:p\.|pág\.?)\s*(\d+)', source_info, re.IGNORECASE)
                page = int(page_match.group(1)) if page_match else None
                
                # El título es lo que queda antes de la coma o el año
                title = re.split(r',|\d{4}', source_info)[0].strip()
                
                citations.append({
                    "source_title": title[:40], # Limitamos longitud
                    "text_segment": text,
                    "page_number": page
                })

            # Patrón B: Si el mensaje tiene una sección de "Referencias" o "Bibliografía" al final
            ref_section = re.split(r'Referencias|Bibliografía|Fuentes consultadas', result.answer, flags=re.IGNORECASE)
            if len(ref_section) > 1:
                ref_text = ref_section[-1]
                # Cada línea que parece una entrada APA
                entries = re.findall(r'(?:^|\n)\d*\.?\s*([^(\n]+(?:\(\d{4}\))[^.\n]+)', ref_text)
                for entry in entries:
                    if len(entry) > 20: # Evitar falsos positivos
                        citations.append({
                            "source_title": "Referencia Bibliográfica",
                            "text_segment": entry.strip(),
                            "page_number": None
                        })

        # Limpiar duplicados por text_segment
        seen_segments = set()
        unique_citations = []
        for c in citations:
            if c["text_segment"] not in seen_segments:
                unique_citations.append(c)
                seen_segments.add(c["text_segment"])
        
        final_citations = unique_citations[:6]
        logfire.info(f"Citas finales extraídas: {len(final_citations)}")
        
        return {
            "answer": str(result.answer),
            "citations": final_citations
        }

    async def close(self) -> None:
        if self._refresh_task:
            self._refresh_task.cancel()
        if self.client_ctx:
            try:
                await self.client_ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self.client = None
            self.client_ctx = None

# Singleton para uso en la app
notebook_service = NotebookLMService()
