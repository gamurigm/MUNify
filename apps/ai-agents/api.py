# pyre-ignore-all-errors
import os
import subprocess
import tempfile
import shutil
import logfire  # pyre-ignore
from fastapi import FastAPI, HTTPException  # pyre-ignore
from fastapi.responses import FileResponse  # pyre-ignore
from pydantic import BaseModel  # pyre-ignore
from typing import List, Optional, Any
from dotenv import load_dotenv  # pyre-ignore
from pathlib import Path

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

app = FastAPI(
    title="MUNify AI Agents API",
    description="API for triggering LangGraph AI agents to generate MUN documents",
    version="2.0.0"
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

class IngestRequest(BaseModel):
    notebookTitle: str
    files: List[str]  # Absolute paths to PDFs

@app.post("/api/v1/ingest-context")
async def ingest_context(request: IngestRequest):
    """Crea un notebook y sube archivos PDF para contexto."""
    try:
        notebook_id = await notebook_service.ingest_professional_context(
            request.notebookTitle, 
            request.files
        )
        return {"notebook_id": notebook_id, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
