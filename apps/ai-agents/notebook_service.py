# pyre-ignore-all-errors
from notebooklm import NotebookLMClient
import os
import asyncio
from typing import List, Optional, Any
import logfire # pyre-ignore

class NotebookLMService:
    def __init__(self) -> None:
        self.storage_path: str = os.path.expanduser("~/.notebooklm/storage_state.json")
        self.client_ctx: Any = None
        self.client: Any = None

    async def get_client(self) -> Any:
        if not self.client:
            if not os.path.exists(self.storage_path):
                raise Exception("NotebookLM no autenticado. Ejecute 'notebooklm login' en el servidor.")
            
            # NotebookLMClient.from_storage is an async function that returns an async context manager
            # Usage: async with await NotebookLMClient.from_storage() as client:
            try:
                ctx_mgr = await NotebookLMClient.from_storage(self.storage_path)
                self.client_ctx = ctx_mgr
                self.client = await ctx_mgr.__aenter__()
            except Exception as e:
                logfire.error(f"Failed to initialize NotebookLM client: {e}")
                raise
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
            print(f"Notebook creado: {target_nb.id if target_nb else 'manual'}")
        
        nb_id: str = target_nb.id if target_nb else "unknown"
        
        # 2. Subir archivos
        for path in file_paths:
            if os.path.exists(path):
                print(f"Subiendo fuente: {path}")
                await client.sources.add_file(nb_id, path, wait=True)
        
        return nb_id

    @logfire.instrument("NotebookLM: Query Context")
    async def query_notebook(self, notebook_id: str, prompt: str) -> str:
        """Consulta el contexto profesional ingerido."""
        client = await self.get_client()
        result = await client.chat.ask(notebook_id, prompt)
        return str(result.answer)

    async def close(self) -> None:
        if self.client_ctx:
            try:
                await self.client_ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self.client = None
            self.client_ctx = None

# Singleton para uso en la app
notebook_service = NotebookLMService()
