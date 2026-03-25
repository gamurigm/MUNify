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
import json
import re

# Variable global para trackear el proceso de login interactivo
login_process_store: Dict[str, subprocess.Popen] = {}

# Load .env relative to this file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize Logfire
logfire.configure(
    token=os.getenv("LOGFIRE_TOKEN"),
    send_to_logfire=bool(os.getenv("LOGFIRE_TOKEN")),
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
from services.job_store import job_store  # type: ignore
from services.telemetry import telemetry  # type: ignore

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
    thread_id = request.threadId or f"draft_{request.committee}_{request.country}_{str(request.topic)[:10]}"  # pyre-ignore
    return {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 20
    }

def _format_generate_response(result: Dict[str, Any], thread_id: str = "") -> GenerateResponse:
    # Detectar si el grafo está interrumpido (esperando selección)
    is_interrupted = len(result.get("research_data", [])) == 0 and len(result.get("raw_findings", [])) > 0
    
    return GenerateResponse(
        status="waiting_selection" if is_interrupted else "completed",  # pyre-ignore
        draft=str(result.get("draft", "")),  # pyre-ignore
        draft_html=str(result.get("draft_html", "")),  # pyre-ignore
        strategy_guide=str(result.get("strategy_guide", "")),  # pyre-ignore
        errors=result.get("errors", []),  # pyre-ignore
        research_data=result.get("research_data", []),  # pyre-ignore
        raw_findings=result.get("raw_findings", []),  # pyre-ignore
        recommended_indices=result.get("recommended_indices", []),  # pyre-ignore
        thread_id=thread_id  # pyre-ignore
    )  # type: ignore

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
        if len(str(last_user_msg).split()) > 4:
            search_query = f"{request.topic} {last_user_msg}"
        else:
            search_query = f"{request.topic} {last_user_msg}"
        
        # --- NUEVA CAPA: Deep Research (Opcional) ---
        deep_research_context = ""
        if request.deepResearch:
            from nodes.research_nodes import research_planner_node, research_executor_node, research_synthesizer_node  # type: ignore
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
        is_explicit_un_query = any(kw in str(last_user_msg).lower() for kw in un_trigger_keywords)
        
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
                            unique_cited.append(CitedArticle(treaty=a["treaty"], article_id=str(a["id"]), text=a["text"]))  # type: ignore
                            seen_treaties.add(a["treaty"])
                        if len(unique_cited) >= 4: break
                    cited = unique_cited
                
                return ChatResponse(
                    response=nlm_result["answer"],  # pyre-ignore
                    cited_articles=cited,  # pyre-ignore
                    notebook_citations=notebook_citations  # pyre-ignore
                )  # type: ignore
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
                    cited.append(CitedArticle(treaty=a["treaty"], article_id=str(a["id"]), text=a["text"]))  # type: ignore
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
    from services.semantic_cache import semantic_cache  # type: ignore
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
            from services.semantic_cache import semantic_cache  # type: ignore
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


@app.get("/api/v1/relations")
async def get_international_relations(country: str = "NOR"):
    """Devuelve un grafo de relaciones internacionales para un país dado."""
    # Mock data para visualización impactante (react-force-graph-3d)
    
    nodes = [
        {"id": "NOR", "name": "Noruega", "group": 1, "val": 20},
        {"id": "SWE", "name": "Suecia", "group": 1, "val": 15},
        {"id": "FIN", "name": "Finlandia", "group": 1, "val": 15},
        {"id": "DNK", "name": "Dinamarca", "group": 1, "val": 15},
        {"id": "ISL", "name": "Islandia", "group": 1, "val": 10},
        {"id": "USA", "name": "Estados Unidos", "group": 2, "val": 25},
        {"id": "GBR", "name": "Reino Unido", "group": 2, "val": 20},
        {"id": "RUS", "name": "Unión Soviética", "group": 3, "val": 25},
        {"id": "CHN", "name": "China", "group": 3, "val": 20},
        {"id": "FRA", "name": "Francia", "group": 4, "val": 18},
        {"id": "DEU", "name": "Alemania", "group": 4, "val": 18},
        {"id": "BRA", "name": "Brasil", "group": 5, "val": 12},
        {"id": "ZAF", "name": "Sudáfrica", "group": 6, "val": 10},
    ]
    
    links = [
        {"source": "NOR", "target": "SWE", "type": "alliance", "color": "#00ff00"},
        {"source": "NOR", "target": "FIN", "type": "alliance", "color": "#00ff00"},
        {"source": "NOR", "target": "DNK", "type": "alliance", "color": "#00ff00"},
        {"source": "NOR", "target": "ISL", "type": "alliance", "color": "#00ff00"},
        {"source": "NOR", "target": "USA", "type": "treaty", "color": "#0088ff"},
        {"source": "NOR", "target": "GBR", "type": "treaty", "color": "#0088ff"},
        {"source": "USA", "target": "GBR", "type": "alliance", "color": "#00ff00"},
        {"source": "USA", "target": "RUS", "type": "tension", "color": "#ff0000"},
        {"source": "NOR", "target": "RUS", "type": "tension", "color": "#ffaa00"},
        {"source": "RUS", "target": "CHN", "type": "alliance", "color": "#00ff00"},
        {"source": "FRA", "target": "DEU", "type": "alliance", "color": "#00ff00"},
        {"source": "USA", "target": "FRA", "type": "treaty", "color": "#0088ff"},
        {"source": "NOR", "target": "DEU", "type": "trade", "color": "#aaaaaa"},
        {"source": "NOR", "target": "FRA", "type": "trade", "color": "#aaaaaa"},
        {"source": "NOR", "target": "BRA", "type": "trade", "color": "#aaaaaa"},
        {"source": "NOR", "target": "ZAF", "type": "diplomatic", "color": "#ffffff"},
        {"source": "SWE", "target": "FIN", "type": "alliance", "color": "#00ff00"},
    ]
    
    return {"nodes": nodes, "links": links}

@app.get("/api/v1/relations/html")
async def get_international_relations_html():
    # pyre-ignore[21]
    from fastapi.responses import HTMLResponse
    # pyre-ignore[21]
    from generate_map import generate_interactive_map
    
    html_path = os.path.join(os.path.dirname(__file__), "intelmap_noruega.html")
    
    # Check if we generated it already, else we could generate it on the fly
    if not os.path.exists(html_path):
        generate_interactive_map()
        
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # We strip out inline styles on body if any to let it fill the iframe cleanly
    html_content = html_content.replace('margin:0;', 'margin:0; overflow:hidden;')
    
    return HTMLResponse(content=html_content)


# ═══════════════════════════════════════════════════════════════
# DEEP RESEARCH ENDPOINT — Fuentes en tiempo real
# ═══════════════════════════════════════════════════════════════
from urllib.parse import urlparse

# Mapeo de dominios a categorías y logos
DOMAIN_CATEGORIES = {
    "un.org": ("ONU", "🇺🇳", "legal"),
    "ohchr.org": ("OHCHR", "🇺🇳", "legal"),
    "icj-cij.org": ("Corte Internacional", "⚖️", "legal"),
    "amnesty.org": ("Amnistía Internacional", "🕯️", "ong"),
    "hrw.org": ("Human Rights Watch", "👁️", "ong"),
    "icrc.org": ("Cruz Roja Internacional", "🏥", "ong"),
    "reuters.com": ("Reuters", "📰", "periodismo"),
    "bbc.com": ("BBC", "📺", "periodismo"),
    "bbc.co.uk": ("BBC", "📺", "periodismo"),
    "aljazeera.com": ("Al Jazeera", "📡", "periodismo"),
    "theguardian.com": ("The Guardian", "📰", "periodismo"),
    "foreignaffairs.com": ("Foreign Affairs", "🌐", "think_tank"),
    "sipri.org": ("SIPRI", "🔬", "think_tank"),
    "brookings.edu": ("Brookings", "🏛️", "think_tank"),
    "worldbank.org": ("World Bank", "💰", "datos"),
    "scholar.google.com": ("Google Scholar", "📚", "academico"),
    "jstor.org": ("JSTOR", "📖", "academico"),
    "europa.eu": ("Unión Europea", "🇪🇺", "legal"),
    "oas.org": ("OEA", "🌎", "legal"),
}

def _classify_source(url: str):
    """Clasifica una URL en categoría, nombre y emoji."""
    try:
        domain = urlparse(url).netloc.replace("www.", "")
        for known_domain, (name, emoji, category) in DOMAIN_CATEGORIES.items():
            if known_domain in domain:
                return {"name": name, "emoji": emoji, "category": category, "domain": domain}
        # Dominio desconocido
        short = domain.split(".")[-2] if "." in domain else domain
        return {"name": short.capitalize(), "emoji": "🔗", "category": "web", "domain": domain}
    except Exception:
        return {"name": "Fuente", "emoji": "🔗", "category": "web", "domain": "unknown"}


@app.post("/api/v1/deep-research")
async def deep_research_search(body: dict):
    """Ejecuta una ronda de investigación profunda generando queries dinámicamente con LLM."""
    topic = body.get("topic", "human rights")
    country = body.get("country", "Norway")
    custom_context = body.get("context", "")
    round_num = body.get("round", 1)

    # pyre-ignore[21]
    from services.llm import fast_llm, tavily
    # pyre-ignore[21]
    from langchain_core.messages import HumanMessage, SystemMessage

    # Bucle de reintentos para asegurar que encontramos fuentes
    max_attempts = 3
    sources = []
    queries = []
    seen_urls = set()

    async def search_one(q):
        try:
            res = await asyncio.to_thread(
                tavily.search, query=q, search_depth="advanced", max_results=5
            )
            return res.get("results", [])
        except Exception as e:
            print(f"Error en Tavily para '{q}': {e}")
            return []

    for attempt in range(1, max_attempts + 1):
        # Modificar el prompt si estamos reintentando
        retry_context = ""
        if attempt > 1:
            retry_context = f"\n⚠️ ATENCIÓN: Esta es la iteración de búsqueda #{attempt}. La búsqueda anterior NO devolvió resultados. USA TÉRMINOS MUCHO MÁS AMPLIOS, DIFERENTES Y MENOS RESTRICTIVOS."

        # El LLM genera las queries obedeciendo el contexto estricto
        prompt = f"""Eres un investigador geopolítico de élite para el Modelo de Naciones Unidas.
Tu objetivo es generar EXACTAMENTE 4 consultas de búsqueda en INGLÉS para investigar este caso.

País: {country}
Tema: {topic}

REGLAS Y CONTEXTO HISTÓRICO (ESTRICTAMENTE OBLIGATORIO):
{custom_context if custom_context else "Ninguna regla específica. Búsqueda moderna."}{retry_context}

Ronda actual: {round_num} de 3.
Ronda 1: Búsqueda legal y general (postura en la ONU, tratados).
Ronda 2: Contexto geopolítico y lagunas (alianzas, tensiones).
Ronda 3: Búsqueda profunda (detalles, papers, estadísticas históricas).

Genera consultas ultra-optimizadas compatibles con motores de búsqueda.
Responde ÚNICAMENTE con un array JSON de 4 strings.
Ejemplo: ["Norway UN Security Council statement 1989", "Norwegian foreign policy Cold War"]
        """

        try:
            response = await fast_llm.ainvoke([
                SystemMessage(content="Eres un generador de queries de alta precisión. Responde SOLO en JSON."),
                HumanMessage(content=prompt)
            ])
            content_str = str(getattr(response, "content", "[]"))
            json_match = re.search(r'\[.*\]', content_str, re.DOTALL)
            if json_match:
                content_str = json_match.group(0)
                
            queries = json.loads(content_str)
            if not isinstance(queries, list):
                queries = [f"{country} {topic} UN position"]
        except Exception as e:
            print(f"Error generando queries: {e}")
            queries = [
                f"{country} {topic} official position",
                f"{country} {topic} international response",
                f"{country} UN Security council {topic}",
            ]

        # pyre-ignore
        batches = await asyncio.gather(*[search_one(q) for q in queries[:4]])

        for batch in batches:
            if not isinstance(batch, list):
                continue
            for result in batch:
                url = result.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                classification = _classify_source(url)
                sources.append({
                    "url": url,
                    "title": result.get("title", "Sin título"),
                    "snippet": result.get("content", "")[:250],
                    "full_text": result.get("content", ""),  # Texto completo para búsqueda profunda
                    "domain": classification["domain"],
                    "source_name": classification["name"],
                    "emoji": classification["emoji"],
                    "category": classification["category"],
                })

        # Si encontramos fuentes, rompemos el bucle y avanzamos
        if len(sources) > 0:
            break


    return {
        "round": round_num,
        "query_count": len(queries),
        "source_count": len(sources),
        "generated_queries": queries,
        "sources": sources,
    }

# ═══════════════════════════════════════════════════════════════
# DRAFTING TERMINAL AGENT ENDPOINT (OPEN CLAW / DEV AGENT MODE)
# ═══════════════════════════════════════════════════════════════
@app.post("/api/v1/agent/drafting-terminal")
async def drafting_terminal_agent(body: dict):
    """Agente Autónomo de fases: 1) Prompt Engineering 2) Deep Research Trigger 3) Drafting."""
    question = str(body.get("question") or "")
    doc_context = str(body.get("document_context") or "")
    history = body.get("history", [])

    # pyre-ignore[21]
    from services.llm import scribe_llm
    # pyre-ignore[21]
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage  # type: ignore
    from datetime import datetime
    
    current_date = datetime.now().strftime("%Y-%m-%d")
    current_year = current_date[:4]  # type: ignore[index]
    
    sys_prompt = f"""Eres el 'MUNify Autonomous Terminal Agent'. Tu misión es asistir en la creación impecable de documentos diplomáticos.
[DIRECTIVA DE ROL - AÑO 2026]: Estamos en una simulación inmersiva donde el AÑO ACTUAL ES {current_year}. Actúa, analiza y recomienda EXACTAMENTE como si estuviéramos en {current_year}. NUNCA rompas el personaje mencionando tu fecha de entrenamiento o el año 2024. Tu herramienta de búsqueda web (FASE 2) tiene acceso en tiempo real a los eventos actuales. Si el usuario pide datos de {current_year}, asúmelos como eventos del PRESENTE.
TIENES 4 FASES DE TRABAJO (No te saltes la Fase 1):
FASE 1 - Refinamiento de Prompt: Si el usuario pide investigar un tema, NO busques de inmediato. Hazle preguntas iterativas para construir el "Prompt Perfecto" (¿Qué país representa? ¿Cuál es el límite temporal exacto?, ¿Se enfoca en economía, seguridad o derechos humanos?). Sigue charlando hasta que el usuario confirme el enfoque.
FASE 2 - Activación Mixta (Notebook + Web): Una vez el usuario aprueba el enfoque y si el usuario tiene un contexto documental establecido (indicado en el prompt), tu acción será 'trigger_mixed_research'. Si solo es investigación libre sin cuaderno, tu acción es 'trigger_research'.
FASE 3 - Análisis y Redacción: Cuando ya tengas en el historial la inyección del texto investigado, discute con el usuario qué ideas filtrar. Cuando decida que quieres redactar, tu acción será 'draft' e incluirás el HTML en "draft_html".

Contexto actual de la hoja:
{doc_context[:30000]}...  # type: ignore[index]

RESPONDE **ÚNICAMENTE** EN ESTE FORMATO JSON ESTRICTO, sin usar comentarios tipo //, sin backticks ni texto adicional fuera de las llaves:
{{
  "reply": "Tu respuesta conversacional para el usuario (la pregunta de refinamiento o el análisis).",
  "action": "chat",
  "research_topic": "El tema ultra-específico si action es trigger_research o trigger_mixed_research",
  "research_context": "El contexto u orientación particular para guiar la búsqueda profunda",
  "draft_html": "<p>Tercera persona o texto mejorado</p>"
}}
Nota para la clavel 'action': los valores válidos son SOLAMENTE "chat", "trigger_research", "trigger_mixed_research", o "draft".
"""
    messages = [SystemMessage(content=sys_prompt)]
    
    for msg in history:
        if msg.get("role") == "user": messages.append(HumanMessage(content=msg.get("content", "")))
        else: messages.append(AIMessage(content=msg.get("content", "")))
            
    messages.append(HumanMessage(content=question))
    
    try:
        response = await scribe_llm.ainvoke(messages)
        content = str(getattr(response, "content", "{}")).strip()
        
        # Super-robust extraction using regex to find the first '{' and last '}'
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
            
        parsed = json.loads(content)
        
        return {
            "answer": parsed.get("reply", "Procesado."),
            "action": parsed.get("action", "chat"),
            "research_topic": parsed.get("research_topic", ""),
            "research_context": parsed.get("research_context", ""),
            "new_draft": parsed.get("draft_html", "")
        }
        
    except Exception as e:
        print("Agent Terminal Error:", e, "\nContent was:", getattr(response, "content", "None"))
        return {"answer": "Error interno al decodificar la instrucción IA (formato JSON corrupto). Por favor, repite la solicitud.", "action": "chat"}
# ═══════════════════════════════════════════════════════════════
# BLOC / ALLIANCE MANAGEMENT (In-Memory for LAN Demo)
# ═══════════════════════════════════════════════════════════════
blocs_store: Dict[str, dict] = {}

class CreateBlocRequest(BaseModel):
    name: str
    committee_id: str
    creator_country: str

@app.post("/api/v1/blocs")
async def create_bloc(request: CreateBlocRequest):
    """Crea un nuevo bloc/alianza para co-edición colaborativa."""
    bloc_id = f"bloc_{uuid.uuid4().hex[:8]}"  # type: ignore[index]
    room_slug = request.name.lower().replace(" ", "_").replace("'", "")
    blocs_store[bloc_id] = {
        "id": bloc_id,
        "name": request.name,
        "committee_id": request.committee_id,
        "members": [request.creator_country],
        "created_by": request.creator_country,
        "room_name": f"bloc_{room_slug}_{request.committee_id}",
        "chat": [],
    }
    logfire.info(f"Bloc created: {request.name} by {request.creator_country}")
    return blocs_store[bloc_id]

@app.get("/api/v1/blocs/{committee_id}")
async def list_committee_blocs(committee_id: str):
    """Lista todos los blocs activos en un comité."""
    return {"blocs": [b for b in blocs_store.values() if b["committee_id"] == committee_id]}

@app.post("/api/v1/blocs/{bloc_id}/join")
async def join_bloc(bloc_id: str, body: dict):
    """Un país se une a un bloc existente."""
    if bloc_id not in blocs_store:
        raise HTTPException(404, "Bloc no encontrado")
    country = body.get("country", "Desconocido")
    if country not in blocs_store[bloc_id]["members"]:
        blocs_store[bloc_id]["members"].append(country)
    return blocs_store[bloc_id]

@app.post("/api/v1/blocs/{bloc_id}/leave")
async def leave_bloc(bloc_id: str, body: dict):
    """Un país abandona un bloc. Si queda vacío, se disuelve."""
    if bloc_id not in blocs_store:
        raise HTTPException(404, "Bloc no encontrado")
    country = body.get("country", "Desconocido")
    blocs_store[bloc_id]["members"] = [m for m in blocs_store[bloc_id]["members"] if m != country]
    if not blocs_store[bloc_id]["members"]:
        del blocs_store[bloc_id]  # type: ignore[arg-type]
        return {"status": "dissolved", "message": f"Bloc disuelto por ausencia de miembros."}
    return blocs_store[bloc_id]

@app.post("/api/v1/blocs/{bloc_id}/chat")
async def bloc_chat_message(bloc_id: str, body: dict):
    """Envía un mensaje al chat del bloc."""
    if bloc_id not in blocs_store:
        raise HTTPException(404, "Bloc no encontrado")
    msg = {
        "country": body.get("country", "Anón"),
        "text": body.get("text", ""),
        "timestamp": str(asyncio.get_event_loop().time()),
    }
    blocs_store[bloc_id]["chat"].append(msg)
    # Mantener solo los últimos 100 mensajes
    blocs_store[bloc_id]["chat"] = blocs_store[bloc_id]["chat"][-100:]
    return {"status": "sent", "chat": blocs_store[bloc_id]["chat"]}

@app.get("/api/v1/blocs/{bloc_id}/chat")
async def get_bloc_chat(bloc_id: str):
    """Obtiene el historial de chat del bloc."""
    if bloc_id not in blocs_store:
        raise HTTPException(404, "Bloc no encontrado")
    return {"chat": blocs_store[bloc_id]["chat"], "members": blocs_store[bloc_id]["members"]}


# ═══════════════════════════════════════════════════════════════
# ARGUMENT GENERATOR (Pros & Cons Analysis)
# ═══════════════════════════════════════════════════════════════
class ArgumentRequest(BaseModel):
    topic: str
    country: str
    committee: str
    parameters: Optional[List[str]] = None
    source_context: Optional[str] = None

@app.post("/api/v1/chat/arguments")
async def generate_arguments(request: ArgumentRequest):
    """Genera argumentos estructurados A FAVOR y EN CONTRA, alimentados por la Cola de Prioridad."""
    from services.llm import fast_llm  # pyre-ignore
    from langchain_core.messages import SystemMessage, HumanMessage  # pyre-ignore

    params_text = ""
    if request.parameters:
        params_text = "Fuentes de investigación recopiladas (Cola de Prioridad):\n" + "\n".join(f"- {p}" for p in request.parameters)  # type: ignore[arg-type]

    source_block = ""
    if request.source_context:
        src_text = request.source_context[:8000]  # type: ignore[index]
        source_block = f"""
EVIDENCIA RECOPILADA POR EL DELEGADO (OBLIGATORIO USAR COMO BASE):
{src_text}

REGLA CRÍTICA: Cada argumento DEBE referenciar al menos una de estas fuentes en su 'legal_basis'.
Si una fuente no aplica, cita el tratado o resolución más cercana, pero PRIORIZA la evidencia del delegado.
"""

    prompt = f"""Eres un analista geopolítico de élite del Modelo de Naciones Unidas.
Genera argumentos estructurados A FAVOR y EN CONTRA sobre el siguiente tema.

País que representa: {request.country}
Comité: {request.committee}
Tema/Propuesta: {request.topic}
{params_text}
{source_block}
INSTRUCCIONES:
- Los argumentos A FAVOR deben ser desde la perspectiva de {request.country}.
- Los argumentos EN CONTRA deben anticipar objeciones de países opositores.
- Cada argumento DEBE citar fuentes de la evidencia recopilada cuando sea posible.

RESPONDE ÚNICAMENTE en JSON puro (sin backticks, sin markdown):
{{
  "arguments_for": [
    {{"point": "Título conciso", "detail": "Explicación en 2-3 oraciones citando fuentes", "legal_basis": "Fuente específica de la evidencia o tratado relevante", "strength": "alta|media|baja"}}
  ],
  "arguments_against": [
    {{"point": "Título conciso", "detail": "Explicación en 2-3 oraciones citando fuentes", "legal_basis": "Fuente específica de la evidencia o tratado relevante", "strength": "alta|media|baja"}}
  ]
}}
Genera exactamente 4 argumentos a favor y 4 en contra."""

    try:
        response = await fast_llm.ainvoke([
            SystemMessage(content="Genera JSON puro sin markdown ni backticks."),
            HumanMessage(content=prompt)
        ])

        content = str(getattr(response, "content", "{}"))
        import re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)

        parsed = json.loads(content)
        return {"topic": request.topic, "country": request.country, **parsed}
    except Exception as e:
        logfire.error(f"Argument Generator Error: {e}")
        return {"topic": request.topic, "country": request.country, "arguments_for": [], "arguments_against": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════════
# USER FEEDBACK STORE (In-Memory, per committee)
# ═══════════════════════════════════════════════════════════════
# Stores the last N user feedback actions per committee session
feedback_store: Dict[str, list] = {}  # committee_id -> [{action, domain, title, keywords, ts}]

class QueueFeedbackRequest(BaseModel):
    committee_id: str
    action: str  # 'inject' | 'delete' | 'promote'
    source: dict  # {title, domain, snippet, url}

@app.post("/api/v1/queue/feedback")
async def record_queue_feedback(request: QueueFeedbackRequest):
    """Registra una acción explícita del usuario sobre la cola para retroalimentación."""
    cid = request.committee_id
    if cid not in feedback_store:
        feedback_store[cid] = []

    # Extraer keywords simples del snippet para matching futuro
    snippet_words = set(request.source.get("snippet", "").lower().split())
    # Filtrar stopwords cortas
    keywords = [w for w in snippet_words if len(w) > 4][:10]  # type: ignore[index]

    entry = {
        "action": request.action,
        "domain": request.source.get("domain", "unknown"),
        "title": request.source.get("title", ""),
        "keywords": keywords,
        "ts": str(asyncio.get_event_loop().time()),
    }
    feedback_store[cid].append(entry)
    # Mantener solo los últimos 50 eventos por comité
    feedback_store[cid] = feedback_store[cid][-50:]  # type: ignore[index]

    logfire.info(f"Queue feedback recorded: {request.action} on {entry['domain']} for {cid}")
    return {"status": "recorded", "total_feedback": len(feedback_store[cid])}

# ═══════════════════════════════════════════════════════════════
# AUTONOMOUS QUEUE REFINER (Background Loop Agent) — v2 Algorithmic
# ═══════════════════════════════════════════════════════════════
class QueueRefineRequest(BaseModel):
    sources: List[dict]
    committee_id: str
    document_context: Optional[str] = None
    engineering_context: Optional[str] = None  # Content from .md files (Context Engineering)
    notebook_ids: Optional[List[str]] = None   # All connected notebooks for cross-ref
    weights: Optional[Dict[str, float]] = None  # Dynamic weight overrides from user answers

@app.post("/api/v1/queue/refine")
async def refine_queue(request: QueueRefineRequest):
    """Agente autónomo v2: Combina algoritmo de scoring matemático + LLM para gap analysis."""
    if not request.sources:
        return {"refined_sources": [], "actions_taken": [], "gaps": [], "questions": []}

    from services.queue_scoring import (  # type: ignore
        compute_utility_scores,
        detect_uncertainty_questions,
    )

    # === 1. Build context text from engineering .md + document ===
    context_parts = []
    if request.engineering_context:
        context_parts.append(request.engineering_context[:5000])  # type: ignore[index]
    if request.document_context:
        context_parts.append(request.document_context[:3000])  # type: ignore[index]
    full_context = "\n".join(context_parts)

    # === 2. Gather feedback history for this committee ===
    cid = request.committee_id
    fb_history = feedback_store.get(str(cid), [])

    # === 3. Compute algorithmic utility scores ===
    utility_scores, breakdown = compute_utility_scores(
        sources=request.sources,
        context_text=full_context,
        feedback_history=fb_history,
        weights=request.weights,
    )

    # === 4. Use LLM only for gap analysis (what's missing) ===
    gaps: List[str] = []
    quality_scores: List[float] = []
    try:
        sources_subset = request.sources[:15]  # type: ignore
        sources_summary = "\n".join(
            f"[{i+1}] {s.get('title','?')} ({s.get('domain','?')})"
            for i, s in enumerate(sources_subset)
        )
        doc_hint = full_context[:1500] if full_context else "Sin contexto adicional."  # type: ignore[index]
        
        gap_prompt = f"""Analiza estas fuentes e identifica qué temas FALTAN.
FUENTES: {sources_summary}
CONTEXTO: {doc_hint}
Responde SOLO en JSON: {{"gaps": ["tema faltante 1", "tema faltante 2"], "quality_scores": [1-10 por fuente]}}"""
        
        gap_response = await fast_llm.ainvoke([
            SystemMessage(content="JSON puro sin backticks."),
            HumanMessage(content=gap_prompt)
        ])
        gap_content = str(getattr(gap_response, "content", "{}"))
        gap_match = re.search(r'\{.*\}', gap_content, re.DOTALL)
        if gap_match:
            gap_parsed = json.loads(gap_match.group(0))
            gaps = gap_parsed.get("gaps", [])[:5]
            quality_scores = gap_parsed.get("quality_scores", [])
    except Exception as e:
        logfire.warning(f"LLM gap analysis failed (non-critical): {e}")

    # === 5. Sort sources by utility score (descending) ===
    indexed = list(enumerate(utility_scores))
    indexed.sort(key=lambda x: x[1], reverse=True)
    
    refined = [request.sources[i] for i, _ in indexed if i < len(request.sources)]
    sorted_scores = [s for _, s in indexed]

    # === 6. Generate Active Learning questions ===
    context_sim = breakdown.get("context_similarity", [])
    llm_quality = quality_scores if len(quality_scores) == len(request.sources) else [5.0] * len(request.sources)
    questions = detect_uncertainty_questions(
        sources=request.sources,
        context_similarity=context_sim,
        quality_scores=llm_quality,
        gaps=gaps,
    )

    # === 7. Build actions summary ===
    actions = []
    original_order = list(range(len(request.sources)))
    new_order = [i for i, _ in indexed]
    if new_order != original_order:
        actions.append(f"Re-rankeadas {len(refined)} fuentes por utilidad algorítmica (α={breakdown.get('context_similarity', ['?'])[0]:.2f}...)")
    if questions:
        actions.append(f"Generadas {len(questions)} preguntas de refinamiento activo")
    if gaps:
        actions.append(f"Detectados {len(gaps)} gaps temáticos")

    return {
        "refined_sources": refined,
        "actions_taken": actions,
        "gaps": gaps,
        "questions": questions,
        "utility_scores": sorted_scores,
        "breakdown": breakdown,
        "summary": f"Cola optimizada algorítmicamente. Top score: {max(sorted_scores) if sorted_scores else 0:.3f}",
    }


@app.post("/api/v1/notebook-analyze")
async def analyze_notebook(body: dict):
    """Consulta al NotebookLM para extraer 4 extractos clave sobre un tema específico, devuelto como fuentes."""
    notebook_id = body.get("notebook_id")
    topic = body.get("topic", "")
    context = body.get("context", "")
    
    if not notebook_id:
        raise HTTPException(status_code=400, detail="notebook_id is required")
        
    prompt = f"""Eres un extractor de evidencia documental riguroso.
El delegado está investigando el tema específico: '{topic}'.
Contexto u orientación adicional: '{context}'.

Tu tarea: Revisa exhaustivamente los documentos de este cuaderno y extrae EXACTAMENTE 4 citas textuales o ideas fundamentales que respondan a este tema.

REGLAS:
1. Debes proporcionar citas reales basadas en los documentos subidos.
2. Formatea tu respuesta ÚNICAMENTE como un JSON array válido.
3. El formato de cada objeto debe ser:
[
  {{
    "title": "Breve título de la idea (max 6 palabras)",
    "snippet": "El extracto detallado o la idea fundamental extraída del documento.",
    "source_name": "Nombre real del documento original",
    "page": "Número de página si aplica, o null"
  }}
]
NO incluyas texto fuera del JSON.
"""
    try:
        logfire.info(f"Ejecutando NotebookLM Analysis para el tema: {topic}")
        # Usamos el notebook_service ya existente en api.py
        result = await notebook_service.query_notebook(notebook_id, prompt)
        
        content = str(result.get("answer", "[]"))
        
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
            
        parsed_quotes = json.loads(content)
        
        sources = []
        for q in parsed_quotes:
            sources.append({
                "url": "notebook://local",  # Identificador especial para frontend
                "title": q.get("title", "Extracto de Documento"),
                "snippet": q.get("snippet", ""),
                "domain": "NotebookLM",
                "source_name": q.get("source_name", "Documento Interno"),
                "emoji": "📓",
                "category": "notebook",
            })
            
        return {
            "status": "success",
            "source_count": len(sources),
            "sources": sources
        }
        
    except Exception as e:
        logfire.error(f"Error en Notebook Analysis: {e}")
        return {"status": "error", "sources": [], "error": str(e)}

if __name__ == "__main__":
    import uvicorn  # pyre-ignore
    uvicorn.run(app, host="0.0.0.0", port=8000)
