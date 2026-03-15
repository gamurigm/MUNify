# pyre-ignore-all-errors
import os
import subprocess
import tempfile
import shutil
import logfire  # pyre-ignore
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks  # pyre-ignore
import uuid
from fastapi.responses import FileResponse, StreamingResponse  # pyre-ignore
from pydantic import BaseModel  # pyre-ignore
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv  # pyre-ignore
from pathlib import Path
import asyncio

# Variable global para trackear el proceso de login interactivo
login_process_store: Dict[str, subprocess.Popen] = {}

# Load .env relative to this file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize Logfire
logfire.configure(
    token=os.getenv("LOGFIRE_TOKEN"),
    send_to_logfire=True,
    inspect_arguments=False
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
from services.job_store import job_store
from services.telemetry import telemetry

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
    deepResearch: Optional[bool] = False
    threadId: Optional[str] = None

class GenerateResponse(BaseModel):
    job_id: Optional[str] = None
    status: str = "completed"
    draft: Optional[str] = ""
    draft_html: Optional[str] = ""
    strategy_guide: Optional[str] = ""
    errors: Optional[List[str]] = None
    research_data: Optional[List[str]] = None
    raw_findings: Optional[List[Dict[str, Any]]] = None
    recommended_indices: Optional[List[int]] = None
    thread_id: Optional[str] = None

class ConvertRequest(BaseModel):
    content: str            # HTML content from editor
    
class ConvertResponse(BaseModel):
    latex: str

class CompileRequest(BaseModel):
    latex: str              # LaTeX source to compile

@app.post("/api/v1/generate", response_model=GenerateResponse)
async def generate_document(request: GenerateRequest):
    """Sincrónico (Bloqueante): Úsalo solo para pruebas rápidas o hilos cortos."""
    try:
        initial_state = _prepare_initial_state(request)
        config = _prepare_config(request)
        
        logfire.info(f"Starting synchronous draft generation")
        result = await agent_workflow.ainvoke(initial_state, config)
        return _format_generate_response(result, thread_id=config["configurable"]["thread_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _run_agent_job(job_id: str, request: GenerateRequest):
    """Tarea de fondo para ejecutar el grafo de agentes."""
    try:
        job_store.update_status(job_id, "processing")
        initial_state = _prepare_initial_state(request)
        config = _prepare_config(request)
        
        result = await agent_workflow.ainvoke(initial_state, config)
        
        # Formatear y guardar resultado
        response = _format_generate_response(result, thread_id=config["configurable"]["thread_id"])
        
        # Si está esperando selección, el job está técnicamente 'completado' en su fase inicial
        job_store.update_status(job_id, "completed", result=response.model_dump())
    except Exception as e:
        logfire.info(f"Agent Job {job_id} failed: {e}")
        job_store.update_status(job_id, "failed", error=str(e))

class SelectResearchRequest(BaseModel):
    threadId: str
    selectedIndices: List[int]

@app.post("/api/v1/research/select")
async def select_research_indices(request: SelectResearchRequest, background_tasks: BackgroundTasks):
    """Retoma la generación después de que el usuario elige las fuentes."""
    job_id = job_store.create_job("agent_resume")
    background_tasks.add_task(_resume_agent_job, job_id, request)
    return {"job_id": job_id, "status": "resuming"}

async def _resume_agent_job(job_id: str, request: SelectResearchRequest):
    try:
        job_store.update_status(job_id, "processing")
        config = {"configurable": {"thread_id": request.threadId}}
        
        # 1. Actualizar el estado con los índices seleccionados
        await agent_workflow.aupdate_state(config, {"selected_indices": request.selectedIndices})
        
        # 2. Retomar la ejecución (None como input para continuar desde el breakpoint)
        result = await agent_workflow.ainvoke(None, config)
        
        # 3. Guardar resultado final
        response = _format_generate_response(result)
        job_store.update_status(job_id, "completed", result=response.model_dump())
    except Exception as e:
        logfire.error(f"Resume Job failed: {e}")
        job_store.update_status(job_id, "failed", error=str(e))

def _prepare_initial_state(request: GenerateRequest) -> Dict[str, Any]:
    return {
        "topic": request.topic,
        "country": request.country,
        "committee": request.committee,
        "document_type": request.documentType or "POSITION_PAPER",
        "deep_research": request.deepResearch or False,
        "research_queries": [],
        "iteration_count": 0,
        "research_data": [],
        "legal_context": [],
        "draft": "",
        "draft_html": "",
        "is_valid": False,
        "errors": [],
        "strategy_guide": "",
        "notebook_id": request.notebookId
    }

def _prepare_config(request: GenerateRequest) -> Dict[str, Any]:
    thread_id = request.threadId or f"draft_{request.committee}_{request.country}_{request.topic[:10]}"
    return {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 20
    }

def _format_generate_response(result: Dict[str, Any], thread_id: str = "") -> GenerateResponse:
    # Detectar si el grafo está interrumpido (esperando selección)
    is_interrupted = len(result.get("research_data", [])) == 0 and len(result.get("raw_findings", [])) > 0
    
    return GenerateResponse(
        status="waiting_selection" if is_interrupted else "completed",
        draft=str(result.get("draft", "")),
        draft_html=str(result.get("draft_html", "")),
        strategy_guide=str(result.get("strategy_guide", "")),
        errors=result.get("errors", []),
        research_data=result.get("research_data", []),
        raw_findings=result.get("raw_findings", []),
        recommended_indices=result.get("recommended_indices", []),
        thread_id=thread_id
    )

@app.post("/api/v1/generate/async")
async def generate_document_async(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Asincrónico (No bloqueante): Recomendado para Deep Research o Documentos Largos."""
    job_id = job_store.create_job("agent")
    background_tasks.add_task(_run_agent_job, job_id, request)
    return {"job_id": job_id, "status": "queued"}


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
    deepResearch: Optional[bool] = False

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
        
        # --- NUEVA CAPA: Deep Research (Opcional) ---
        deep_research_context = ""
        if request.deepResearch:
            from nodes.research_nodes import research_planner_node, research_executor_node, research_synthesizer_node
            logfire.info("Ejecutando Deep Research para el Chat...")
            
            # Simulamos el paso por el grafo para esta consulta específica
            research_state = {
                "topic": last_user_msg,
                "country": request.country,
                "deep_research": True,
                "research_queries": [],
                "iteration_count": 0,
                "research_data": []
            }
            # Ejecutamos los nodos secuencialmente
            research_state = await research_planner_node(research_state) # pyre-ignore
            research_state = await research_executor_node(research_state) # pyre-ignore
            research_state = await research_synthesizer_node(research_state) # pyre-ignore
            
            deep_research_context = "\n\nINFORMACIÓN RECIENTE ENCONTRADA (WEB):\n" + "\n".join(research_state["research_data"][:15])
            logfire.info(f"Deep Research completado: {len(research_state['research_data'])} fuentes.")

        
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
                # --- NUEVA CAPA: Deep NLM Interrogation (Doble Bucle) ---
                if request.deepResearch:
                    logfire.info("Ejecutando Deep NLM Interrogation (ML Analysis)...")
                    # Bucle 1: Identificación de estructura y temas clave
                    structure_prompt = (
                        f"Analiza mis documentos para responder a: {last_user_msg}. "
                        "PASO 1: Identifica las 3 fuentes más relevantes y los argumentos técnicos clave que contienen. "
                        "No respondas al usuario todavía, solo extrae la estructura de evidencia."
                    )
                    structure_result = await notebook_service.query_notebook(request.notebookId, structure_prompt)
                    evidence_summary = structure_result.get("answer", "")
                    
                    # Bucle 2: Meta-Análisis y Síntesis Final
                    detailed_prompt = (
                        f"Basado en este análisis previo de mis documentos: {evidence_summary}\n\n"
                        f"Responde de forma magistral y exhaustiva a la consulta original: {last_user_msg}. "
                        "REGLAS CRÍTICAS DE INVESTIGACIÓN PROFUNDA (ML):\n"
                        "1. Integra los datos del cuaderno con la información externa proporcionada si existe.\n"
                        "2. Cada vez que menciones un dato o hecho del cuaderno, debes incluir una CITACIÓN ENTRE PARÉNTESIS con el nombre de la fuente y página.\n"
                        "3. Al final, incluye una sección de 'Bibliografía' en formato APA 7ma edición con los títulos en cursiva.\n"
                        f"INFORMACIÓN WEB ADICIONAL (CROSS-VERIFICATION):\n{deep_research_context}\n"
                    )
                else:
                    # Modo Estándar NLM
                    detailed_prompt = (
                        f"Responde de forma exhaustiva a: {last_user_msg}. "
                        "REGLAS CRÍTICAS:\n"
                        "1. Cada vez que menciones un dato o hecho del cuaderno, debes incluir una CITACIÓN ENTRE PARÉNTESIS con el nombre de la fuente y página si existe.\n"
                        "2. Al final, incluye una sección de 'Bibliografía' en formato APA 7ma edición.\n"
                        f"{deep_research_context}\n"
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
{deep_research_context}
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

@app.post("/api/v1/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """Endpoint de chat con streaming para feedback en tiempo real."""
    async def response_generator():
        try:
            # 1. Preparar Contexto (RAG + Deep Research)
            last_user_msg = ""
            for m in reversed(request.messages): # pyre-ignore
                if m.role == "user":
                    last_user_msg = m.text
                    break
            
            search_query = f"{request.topic} {last_user_msg}"
            
            # --- RAG Estándar ---
            raw_articles = knowledge_base.search_structured(search_query) # pyre-ignore
            cited = []
            for a in raw_articles[:4]:
                 cited.append({"treaty": a["treaty"], "article_id": str(a["id"]), "text": a["text"]})
            
            # Enviar metadatos iniciales (artículos citados)
            yield json.dumps({"type": "metadata", "cited_articles": cited}) + "\n"

            # 2. Configurar LLM y Stream
            system_prompt = f"Eres un Asesor Diplomático IA experto. Ayudas al delegado de {request.country} en {request.committee} sobre '{request.topic}'."
            langchain_msgs = [SystemMessage(content=system_prompt)]
            for m in request.messages[-5:]: # pyre-ignore
                if m.role == "user": langchain_msgs.append(HumanMessage(content=m.text))
                else: langchain_msgs.append(AIMessage(content=m.text))

            # 3. Stream de tokens
            async for chunk in fast_llm.astream(langchain_msgs):
                if chunk.content:
                    yield json.dumps({"type": "content", "text": chunk.content}) + "\n"
                    
        except Exception as e:
            logfire.error(f"Streaming Error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(response_generator(), media_type="text/event-stream")


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

# --- NUEVOS ENDPOINTS DE TRABAJO (JOBS) ---

@app.get("/api/v1/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Consulta el estado y resultado de cualquier tarea en segundo plano (Agent o PDF)."""
    job_data = job_store.get_job(job_id)
    if job_data.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job_data

@app.get("/api/v1/jobs/{job_id}/download")
async def download_job_result(job_id: str):
    """Descarga el PDF resultante de un job completado."""
    from services.semantic_cache import semantic_cache
    path = semantic_cache.client.get(f"job:{job_id}:path")
    
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado o expirado")
    
    return FileResponse(
        path, 
        media_type="application/pdf",
        filename="MUNify_Document.pdf"
    )

async def _bg_compile_task(job_id: str, latex_code: str):
    """Tarea que se ejecuta en el thread pool de FastAPI."""
    try:
        job_store.update_status(job_id, "processing")
        
        # Reutilizamos la lógica de compilación pero guardando el path
        tmpdir = tempfile.mkdtemp(prefix="munify_")
        tex_path = os.path.join(tmpdir, "document.tex")
        pdf_path = os.path.join(tmpdir, "document.pdf")
        
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_code)
        
        templates_src = os.path.join(os.path.dirname(__file__), "templates")
        if os.path.exists(templates_src):
            templates_dst = os.path.join(tmpdir, "templates")
            shutil.copytree(templates_src, templates_dst)
            
        for _ in range(2):
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdir, tex_path],
                capture_output=True, text=True, timeout=60, cwd=tmpdir
            )
            
        if os.path.exists(pdf_path):
            job_store.update_status(job_id, "completed")
            # Para el PDF, persistimos el path en una sub-llave de redis específicamente
            from services.semantic_cache import semantic_cache
            semantic_cache.client.setex(f"job:{job_id}:path", 3600, pdf_path)
        else:
            job_store.update_status(job_id, "failed", error="pdflatex failing to generate PDF")
            
    except Exception as e:
        job_store.update_status(job_id, "failed", error=str(e))

@app.post("/api/v1/compile-pdf/async")
async def trigger_compile_pdf(request: CompileRequest, background_tasks: BackgroundTasks):
    """Inicia la compilación en segundo plano y devuelve un job_id."""
    job_id = job_store.create_job("pdf")
    background_tasks.add_task(_bg_compile_task, job_id, request.latex)
    return {"job_id": job_id, "status": "queued"}

@app.post("/api/v1/compile-pdf-from-html/async")
async def trigger_compile_pdf_html(request: CompileHtmlRequest, background_tasks: BackgroundTasks):
    """Convierte HTML a LaTeX e inicia la compilación en segundo plano."""
    job_id = job_store.create_job("pdf_html")
    latex_body = html_to_latex(request.html)
    
    # Template wrapping logic (simplified for speed here)
    template_path = os.path.join(os.path.dirname(__file__), "templates", "generic.tex")
    with open(template_path, "r", encoding="utf-8") as f:
        full_latex = f.read()
    
    full_latex = full_latex.replace("<<TITLE>>", request.title)
    full_latex = full_latex.replace("<<TOPIC>>", request.topic)
    full_latex = full_latex.replace("<<COUNTRY>>", request.country)
    full_latex = full_latex.replace("<<COMMITTEE>>", request.committee)
    full_latex = full_latex.replace("<<CONTENT>>", latex_body)
    
    background_tasks.add_task(_bg_compile_task, job_id, full_latex)
    return {"job_id": job_id, "status": "queued"}

# --- ENDPOINTS DE CONTEXTO ---

@app.get("/api/v1/telemetry")
async def get_telemetry_stats():
    """Retorna estadísticas de rendimiento, costos y latencia del sistema."""
    return telemetry.get_summary()

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
