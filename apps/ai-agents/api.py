# pyre-ignore-all-errors
import os
import subprocess
import tempfile
import shutil
import logfire  # pyre-ignore
from fastapi import FastAPI, HTTPException, UploadFile, File, Form  # pyre-ignore
from fastapi.responses import FileResponse  # pyre-ignore
from pydantic import BaseModel  # pyre-ignore
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv  # pyre-ignore
from pathlib import Path

# Variable global para trackear el proceso de login interactivo
login_process_store: Dict[str, subprocess.Popen] = {}

# Load .env relative to this file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize Logfire
logfire.configure(
    token=os.getenv("LOGFIRE_TOKEN"),
    send_to_logfire=True
)

try:
    logfire.instrument_httpx()  # pyre-ignore
    logfire.instrument_pydantic()  # pyre-ignore
except Exception:
    pass

logfire.info("MUNify AI Agents Service Started")

# Import workflow AFTER Logfire is configured
from main import app as agent_workflow  # pyre-ignore
from main import latex_to_html, html_to_latex  # pyre-ignore
from notebook_service import notebook_service

from fastapi.middleware.cors import CORSMiddleware # pyre-ignore

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Proactive NotebookLM connection
    try:
        await notebook_service.ensure_client()
    except Exception as e:
        logfire.error(f"Failed to initialize persistent NotebookLM on startup: {e}")
    
    yield
    
    # Graceful shutdown
    await notebook_service.close()

app = FastAPI(
    title="MUNify AI Agents API",
    description="API for triggering LangGraph AI agents to generate MUN documents",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument FastAPI with Logfire
logfire.instrument_fastapi(app)

class GenerateRequest(BaseModel):
    topic: str
    country: str
    committee: str
    documentType: Optional[str] = "POSITION_PAPER"
    notebookId: Optional[str] = None

class GenerateResponse(BaseModel):
    draft: str              # LaTeX source
    draft_html: str         # HTML for Tiptap editor
    strategy_guide: str
    errors: Optional[List[str]] = None
    research_data: Optional[List[str]] = None

class ConvertRequest(BaseModel):
    content: str            # HTML content from editor
    
class ConvertResponse(BaseModel):
    latex: str

class CompileRequest(BaseModel):
    latex: str              # LaTeX source to compile

@app.post("/api/v1/generate", response_model=GenerateResponse)
async def generate_document(request: GenerateRequest):
    try:
        initial_state = {
            "topic": request.topic,
            "country": request.country,
            "committee": request.committee,
            "document_type": request.documentType or "POSITION_PAPER",
            "research_data": [],
            "legal_context": [],
            "draft": "",
            "draft_html": "",
            "is_valid": False,
            "errors": [],
            "strategy_guide": "",
            "notebook_id": request.notebookId
        }
        
        config = {"recursion_limit": 10}
        result = await agent_workflow.ainvoke(initial_state, config)
        
        response_data = {
            "draft": str(result.get("draft", "")),
            "draft_html": str(result.get("draft_html", "")),
            "strategy_guide": str(result.get("strategy_guide", "")),
            "errors": result.get("errors", []),
            "research_data": result.get("research_data", [])
        }
        return GenerateResponse(**response_data) # pyre-ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from services.llm import fast_llm # pyre-ignore
from services.knowledge_base import knowledge_base # pyre-ignore
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage # pyre-ignore

class ChatRequestMsg(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatRequestMsg]
    topic: str
    country: str
    committee: str
    notebookId: Optional[str] = None

class CitedArticle(BaseModel):
    treaty: str
    article_id: str
    text: str

class NotebookCitation(BaseModel):
    source_title: str
    text_segment: str
    page_number: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    cited_articles: Optional[List[CitedArticle]] = None
    notebook_citations: Optional[List[NotebookCitation]] = None

@app.post("/api/v1/chat", response_model=ChatResponse)
async def fast_chat_endpoint(request: ChatRequest):
    try:
        logfire.info(f"Chat request received: {request.committee} - {request.topic}")
        
        # Build search from BOTH the topic AND the user's last message
        last_user_msg = ""
        for m in reversed(request.messages):  # pyre-ignore
            if m.role == "user":
                last_user_msg = m.text
                break
        
        # MEJORA: Priorizar el mensaje específico del usuario para evitar resultados estáticos
        # MEJORA RADICAL: Eliminamos el nombre del comité de la búsqueda.
        # El comité (ej: Asamblea General) contamina el RAG con artículos procedimentales.
        # Solo usamos el tópico y el mensaje específico.
        if len(last_user_msg.split()) > 4:
            search_query = f"{request.topic} {last_user_msg}"
        else:
            search_query = f"{request.topic} {last_user_msg}"
        
        # Get RAG results as raw structured data
        raw_articles = knowledge_base.search_structured(search_query)  # pyre-ignore
        
        # FILTRO CRÍTICO: Si hay notebookId, el RAG solo se activa si hay palabras clave MUY específicas
        # de tratados internacionales para evitar "artículos random" de la ONU
        un_trigger_keywords = ["carta onu", "naciones unidas", "resolución un", "declaración universal", "ginebra"]
        is_explicit_un_query = any(kw in last_user_msg.lower() for kw in un_trigger_keywords)
        
        if request.notebookId and not is_explicit_un_query:
            raw_articles = [] # Limpiamos el RAG si estamos en modo Notebook y no es query ONU
            
        context_str = "\n".join([a["text"] for a in raw_articles]) if raw_articles else ""

        # CASE 1: NotebookLM es la fuente primaria si está vinculado
        if request.notebookId:
            try:
                # Instrucción explícita para mayor detalle y formato APA
                detailed_prompt = (
                    f"Responde de forma exhaustiva a: {last_user_msg}. "
                    "REGLAS CRÍTICAS:\n"
                    "1. Cada vez que menciones un dato o hecho del cuaderno, debes incluir una CITACIÓN ENTRE PARÉNTESIS con el nombre de la fuente y página si existe.\n"
                    "2. Si es una cita directa, úsala entre comillas seguida de (Fuente, Pág).\n"
                    "3. Al final, incluye una sección de 'Bibliografía' en formato APA 7ma edición. "
                    "RECUERDA: En APA 7, el nombre de la revista o el título del libro DEBE IR EN CURSIVA (ej: _Nombre del Libro_ o *Nombre de la Revista*).\n"
                    "Tu respuesta servirá para alimentar un sistema de extracción automática de citas, así que sé muy riguroso con los paréntesis (Fuente, Año/Pág)."
                )
                nlm_result = await notebook_service.query_notebook(request.notebookId, detailed_prompt)
                
                # Transformar citas
                notebook_citations = [
                    NotebookCitation(**cit) for cit in nlm_result.get("citations", [])
                ]
                
                # Filtrar artículos legales por relevancia EXTREMA:
                # Si hay cuaderno, el RAG de la ONU SE APAGA TOTALMENTE a menos que se pida POR NOMBRE.
                legal_keywords = ["artículo", "cláusula", "ley", "convención", "protocolo", "estatuto", "carta", "pacto"]
                wants_legal_explicit = any(kw in last_user_msg.lower() for kw in legal_keywords)
                
                cited = []
                # Solo incluimos artículos si el usuario lo pidió por nombre ('artículo x', 'ley y')
                if wants_legal_explicit and raw_articles:
                    # FILTRO DE DIVERSIDAD: Evitar que todo sea de la 'Carta de la ONU' si hay otros tratados
                    seen_treaties = set()
                    unique_cited = []
                    for a in raw_articles:
                        # Si ya tenemos 2 de un mismo tratado (ej: Carta), buscamos otros
                        treaty_count = sum(1 for x in unique_cited if x.treaty == a["treaty"])
                        if treaty_count < 2 or len(seen_treaties) > 3:
                            unique_cited.append(CitedArticle(treaty=a["treaty"], article_id=str(a["id"]), text=a["text"]))
                            seen_treaties.add(a["treaty"])
                        if len(unique_cited) >= 4: break
                    cited = unique_cited
                
                return ChatResponse(
                    response=nlm_result["answer"],
                    cited_articles=cited,
                    notebook_citations=notebook_citations
                )
            except Exception as e:
                logfire.warning(f"Direct NotebookLM Query failed, falling back to RAG: {e}")

        # CASE 2: Fallback o RAG Estándar (Tratados)
        system_prompt = f"""Eres un Asesor Diplomático IA experto en Naciones Unidas de muy alto nivel.
Ayudas al delegado de {request.country} en el comité {request.committee} sobre '{request.topic}'.
Habla de forma extremadamente profesional, diplomática y profunda. 
Proporciona respuestas detalladas y estructuradas, no te limites a párrafos cortos.
Cita los tratados oficiales solo si son estrictamente relevantes para responder a la consulta."""
        
        # Filtro de artículos para el caso RAG estándar
        legal_keywords = ["artículo", "tratado", "ley", "convención", "protocolo", "legal"]
        needs_legal = any(kw in last_user_msg.lower() for kw in legal_keywords)
        cited = []
        if needs_legal and raw_articles:
            # Aplicar la misma lógica de diversidad en el fallback
            seen_treaties = set()
            for a in raw_articles:
                treaty_count = sum(1 for x in cited if x.treaty == a["treaty"])
                if treaty_count < 2:
                    cited.append(CitedArticle(treaty=a["treaty"], article_id=str(a["id"]), text=a["text"]))
                if len(cited) >= 5: break
        # ELIMINADO: Ya no enviamos artículos por defecto si no se piden
        
        # Convertir historial
        langchain_msgs = [SystemMessage(content=system_prompt)]
        for m in request.messages[-5:]:  # pyre-ignore
            clean_text = str(m.text).replace('\u202f', ' ').replace('\u200b', '')
            if m.role == "user":
                langchain_msgs.append(HumanMessage(content=clean_text))
            else:
                langchain_msgs.append(AIMessage(content=clean_text))
                
        # Llamar a nemotron (fast_llm)
        response = await fast_llm.ainvoke(langchain_msgs)
        
        return ChatResponse(response=str(response.content), cited_articles=cited) # pyre-ignore
    except Exception as e:
        logfire.error(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/convert/html-to-latex", response_model=ConvertResponse)
async def convert_html_to_latex_endpoint(request: ConvertRequest):
    """Convierte HTML del editor Tiptap a LaTeX para persistencia."""
    try:
        result = html_to_latex(str(request.content))
        return ConvertResponse(**{"latex": str(result)}) # pyre-ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CompileHtmlRequest(BaseModel):
    html: str
    title: str
    topic: str
    country: str
    committee: str

@app.post("/api/v1/compile-pdf")
async def compile_pdf(request: CompileRequest):
    """Compila LaTeX a PDF usando pdflatex y devuelve el archivo."""
    return await _do_compile(request.latex)

@app.post("/api/v1/compile-pdf-from-html")
async def compile_pdf_from_html(request: CompileHtmlRequest):
    """Convierte HTML a LaTeX, lo envuelve en una plantilla y compila a PDF."""
    try:
        # Convert HTML to LaTeX body
        latex_body = html_to_latex(request.html)
        
        # Load generic template
        template_path = os.path.join(os.path.dirname(__file__), "templates", "generic.tex")
        with open(template_path, "r", encoding="utf-8") as f:
            full_latex = f.read()
        
        # Replace placeholders
        full_latex = full_latex.replace("<<TITLE>>", request.title)
        full_latex = full_latex.replace("<<TOPIC>>", request.topic)
        full_latex = full_latex.replace("<<COUNTRY>>", request.country)
        full_latex = full_latex.replace("<<COMMITTEE>>", request.committee)
        full_latex = full_latex.replace("<<CONTENT>>", latex_body)
        
        return await _do_compile(full_latex)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HTML to PDF failed: {str(e)}")

# --- ENDPOINTS DE CONTEXTO ---

@app.get("/api/v1/notebook-status")
async def notebook_status():
    """Verifica si NotebookLM está autenticado y disponible."""
    if not notebook_service.is_ready() and notebook_service.is_authenticated():
        # Llamamos a ensure_client. Como es async y usa un lock, es seguro.
        # Si ya hay una tarea intentándolo, el lock lo manejará.
        try:
            # timeout corto para no bloquear el polling del frontend
            await asyncio.wait_for(notebook_service.ensure_client(), timeout=2.0)
        except Exception as e:
            logfire.warning(f"Auto-connection attempt failed during status check: {e}")
        
    return {
        "authenticated": notebook_service.is_authenticated(),
        "ready": notebook_service.is_ready(),
        "storage_path": notebook_service.storage_path,
    }

@app.post("/api/v1/notebook-reconnect")
async def notebook_reconnect():
    """Fuerza la re-inicialización del cliente NotebookLM."""
    try:
        await notebook_service.ensure_client()
        return {
            "status": "success", 
            "authenticated": notebook_service.is_authenticated(),
            "ready": notebook_service.is_ready()
        }
    except Exception as e:
        logfire.error(f"Reconnect failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/notebook-reset-auth")
async def notebook_reset_auth():
    """Limpia completamente los tokens de NotebookLM."""
    await notebook_service.reset_auth()
    return {"status": "reset", "message": "Tokens eliminados correctamente."}

@app.post("/api/v1/notebook-login")
async def notebook_login_trigger():
    """Abre una terminal nueva dedicada al login para que el usuario pueda presionar ENTER."""
    try:
        # Detectar ruta del ejecutable
        login_script = os.path.join(os.getcwd(), "venv", "Scripts", "notebooklm.exe")
        
        # Comando para Windows: Abre una ventana nueva, ejecuta el login y permite que el usuario vea el prompt
        # 'cmd /c' ejecutará el comando y cerrará la ventana al terminar (cuando el usuario de ENTER)
        cmd = f'start "MUNify - NotebookLM Login" cmd /c "{login_script} login"'
        
        logfire.info("Abriendo terminal externa para login interactivo")
        # Pasamos el entorno actual para asegurar que NOTEBOOKLM_HOME se propague
        subprocess.Popen(cmd, shell=True, env=os.environ.copy())
        
        return {
            "status": "triggered", 
            "message": "Se ha abierto una ventana de terminal negra. Haz login en el navegador y PRESIONA ENTER en esa ventana."
        }
            
    except Exception as e:
        logfire.error(f"Failed to launch login terminal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/notebook-login-confirm")
async def notebook_login_confirm():
    """Endpoint de respaldo para forzar la sincronización del cliente una vez hecho el login manual."""
    try:
        # Intentamos conectar el cliente asumiendo que el usuario ya dio ENTER en la terminal externa
        await notebook_service.ensure_client()
        return {
            "status": "success", 
            "message": "Sincronización forzada completada.",
            "ready": notebook_service.is_ready()
        }
    except Exception as e:
        logfire.error(f"Failed to sync client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ingest-context")
async def ingest_context(
    notebookTitle: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Crea un notebook y sube archivos PDF para contexto."""
    temp_dir = tempfile.mkdtemp(prefix="nb_ingest_")
    saved_paths = []
    try:
        for file in files:
            file_path = os.path.join(temp_dir, file.filename)
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            saved_paths.append(file_path)
        
        logfire.info(f"Ingesting {len(saved_paths)} files into NotebookLM: {notebookTitle}")
        
        notebook_id = await notebook_service.ingest_professional_context(
            notebookTitle, 
            saved_paths
        )
        
        # Obtener lista de fuentes del notebook recién creado
        sources = await notebook_service.list_sources(notebook_id)
        
        return {"notebook_id": notebook_id, "status": "success", "sources": sources}
    except Exception as e:
        logfire.error(f"Ingest Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pass

@app.get("/api/v1/notebooks")
async def list_notebooks():
    """Lista todos los notebooks disponibles en NotebookLM."""
    try:
        notebooks = await notebook_service.list_notebooks()
        return {"notebooks": notebooks}
    except Exception as e:
        logfire.error(f"List Notebooks Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/notebooks/{notebook_id}/sources")
async def list_notebook_sources(notebook_id: str):
    """Lista las fuentes de un notebook específico."""
    try:
        sources = await notebook_service.list_sources(notebook_id)
        return {"notebook_id": notebook_id, "sources": sources}
    except Exception as e:
        logfire.error(f"List Sources Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/notebooks/{notebook_id}/append")
async def append_to_notebook(
    notebook_id: str,
    files: List[UploadFile] = File(...)
):
    """Añade archivos a un notebook existente."""
    temp_dir = tempfile.mkdtemp(prefix="nb_append_")
    saved_paths = []
    try:
        for file in files:
            file_path = os.path.join(temp_dir, file.filename)
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            saved_paths.append(file_path)
        
        uploaded = await notebook_service.append_sources(notebook_id, saved_paths)
        sources = await notebook_service.list_sources(notebook_id)
        
        return {
            "notebook_id": notebook_id,
            "uploaded_count": uploaded,
            "sources": sources,
            "status": "success"
        }
    except Exception as e:
        logfire.error(f"Append Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pass

async def _do_compile(latex_code: str):
    tmpdir = tempfile.mkdtemp(prefix="munify_")
    tex_path = os.path.join(tmpdir, "document.tex")
    pdf_path = os.path.join(tmpdir, "document.pdf")
    
    try:
        # Write LaTeX to temp file
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_code)
        
        # Copy templates dir for any \input or \includegraphics
        templates_src = os.path.join(os.path.dirname(__file__), "templates")
        if os.path.exists(templates_src):
            templates_dst = os.path.join(tmpdir, "templates")
            shutil.copytree(templates_src, templates_dst)
        
        # Run pdflatex twice
        for _ in range(2):
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdir, tex_path],
                capture_output=True, text=True, timeout=60, cwd=tmpdir
            )
        
        if not os.path.exists(pdf_path):
            log_path = os.path.join(tmpdir, "document.log")
            log_tail = ""
            if os.path.exists(log_path):
                with open(log_path, "r", encoding="utf-8", errors="ignore") as lf:
                    lines_log: List[Any] = lf.readlines() # pyre-ignore
                    # Usar slice positivo para evitar advertencias de tipado
                    start_idx = max(0, len(lines_log) - 30)
                    log_tail = "".join(lines_log[start_idx:]) # pyre-ignore
            raise HTTPException(status_code=500, detail=f"pdflatex failed:\n{log_tail}")
        
        return FileResponse(
            pdf_path, 
            media_type="application/pdf",
            filename="MUNify_Document.pdf"
        )
    finally:
        # We can't immediately delete tmpdir because FileResponse needs it
        # In a real app, we'd use a BackgroundTask to clean up
        pass


if __name__ == "__main__":
    import uvicorn  # pyre-ignore
    uvicorn.run(app, host="0.0.0.0", port=8000)
