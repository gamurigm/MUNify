# pyre-ignore-all-errors
import os
from typing import TypedDict, List
from langgraph.graph import StateGraph, END  # pyre-ignore
from pydantic import BaseModel, Field  # pyre-ignore
import logfire  # pyre-ignore

# 📝 Definición del Estado del Agente
class AgentState(TypedDict):
    topic: str
    country: str
    committee: str
    document_type: str
    research_data: List[str]
    legal_context: List[str]
    draft: str        # Contenido LaTeX generado
    draft_html: str   # HTML para Tiptap (convertido)
    is_valid: bool
    errors: List[str]
    strategy_guide: str

import os
from dotenv import load_dotenv  # pyre-ignore
from tavily import TavilyClient  # pyre-ignore

load_dotenv()

# 🔑 Inicialización de Clientes
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# [SEARCH] 1. Agente Investigador (Tavily)
@logfire.instrument("Researcher Node")
async def researcher_node(state: AgentState):
    print(f"--- INVESTIGANDO CON TAVILY SOBRE: {state['topic']} ---")
    
    query = f"recent news and geopolitical position of {state['country']} on {state['topic']}"
    search_result = tavily.search(query=query, search_depth="advanced", max_results=5)
    
    context = [res['content'] for res in search_result['results']]
    
    state["research_data"] = context
    print(f"[OK] Se encontraron {len(context)} fuentes relevantes.")
    return state

from langchain_nvidia_ai_endpoints import ChatNVIDIA  # pyre-ignore
from langchain_core.messages import HumanMessage, SystemMessage  # pyre-ignore

import random

# 🔑 Carga de múltiples llaves para Performance/Redundancia
NVIDIA_KEYS = [
    os.getenv("NVIDIA_API_KEY_1"),
    os.getenv("NVIDIA_API_KEY_2"),
    os.getenv("NVIDIA_API_KEY_3"),
    os.getenv("NVIDIA_API_KEY_4"),
    os.getenv("NVIDIA_API_KEY_5")
]

def get_random_key():
    return random.choice([k for k in NVIDIA_KEYS if k])

# 🔑 Inicialización de modelos NVIDIA NIM con balanceo de carga
scribe_llm = ChatNVIDIA(
    model="meta/llama-3.3-70b-instruct",
    api_key=NVIDIA_KEYS[1],
    temperature=0.6,
    max_tokens=4000
)

critic_llm = ChatNVIDIA(
    model="mistralai/mistral-large-3-675b-instruct-2512",
    api_key=NVIDIA_KEYS[2],
    temperature=0.1,
    max_tokens=2048
)

fast_llm = ChatNVIDIA(
    model="nvidia/nemotron-3-nano-30b-a3b",
    api_key=NVIDIA_KEYS[3], 
    temperature=0.1
)

# ── Carga de plantilla LaTeX ──
def load_latex_template(doc_type: str) -> str:
    """Carga la plantilla .tex correspondiente al tipo de documento."""
    templates = {
        "POSITION_PAPER": "templates/position_paper.tex",
        "RESOLUTION": "templates/position_paper.tex",  # Fallback por ahora
    }
    path = templates.get(doc_type, "templates/position_paper.tex")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

# ── Conversión básica LaTeX → HTML para Tiptap ──
def latex_to_html(latex: str) -> str:
    """Convierte LaTeX básico a HTML para el editor Tiptap."""
    import re
    html = latex
    
    # Eliminar preámbulo y document wrappers
    html = re.sub(r'\\documentclass.*?\n', '', html)
    html = re.sub(r'\\usepackage.*?\n', '', html)
    html = re.sub(r'\\geometry\{.*?\}', '', html)
    html = re.sub(r'\\onehalfspacing', '', html)
    html = re.sub(r'\\definecolor\{.*?\}\{.*?\}\{.*?\}', '', html)
    html = re.sub(r'\\pagestyle\{.*?\}', '', html)
    html = re.sub(r'\\fancyhf\{\}', '', html)
    html = re.sub(r'\\fancyhead\[.\]\{.*?\}', '', html)
    html = re.sub(r'\\fancyfoot\[.\]\{.*?\}', '', html)
    html = re.sub(r'\\renewcommand\{.*?\}\{.*?\}', '', html)
    html = re.sub(r'\\titleformat\{.*?\}.*?\n', '', html)
    html = re.sub(r'\\hypersetup\{[^}]*\}', '', html, flags=re.DOTALL)
    html = re.sub(r'\\begin\{document\}', '', html)
    html = re.sub(r'\\end\{document\}', '', html)
    
    # Titlepage → header div
    def titlepage_replace(m):
        content = m.group(1)
        return f'<div class="title-page" style="text-align:center; padding: 2em 0;">{content}</div><hr/>'
    html = re.sub(r'\\begin\{titlepage\}(.*?)\\end\{titlepage\}', titlepage_replace, html, flags=re.DOTALL)
    
    # Secciones
    html = re.sub(r'\\section\{(.*?)\}', r'<h1>\1</h1>', html)
    html = re.sub(r'\\subsection\{(.*?)\}', r'<h2>\1</h2>', html)
    html = re.sub(r'\\subsubsection\{(.*?)\}', r'<h3>\1</h3>', html)
    
    # Formato de texto
    html = re.sub(r'\\textbf\{(.*?)\}', r'<strong>\1</strong>', html)
    html = re.sub(r'\\textit\{(.*?)\}', r'<em>\1</em>', html)
    html = re.sub(r'\\underline\{(.*?)\}', r'<u>\1</u>', html)
    html = re.sub(r'\\textcolor\{[^}]*\}\{(.*?)\}', r'\1', html)
    html = re.sub(r'\\emph\{(.*?)\}', r'<em>\1</em>', html)
    
    # Tamaños de texto
    html = re.sub(r'\{\\Huge\\textbf\{(.*?)\}\}', r'<h1 style="font-size:2.5em">\1</h1>', html)
    html = re.sub(r'\{\\Large\\textbf\{(.*?)\}\}', r'<h2>\1</h2>', html)
    html = re.sub(r'\{\\large (.*?)\}', r'<p style="font-size:1.2em">\1</p>', html)
    html = re.sub(r'\{\\small (.*?)\}', r'<small>\1</small>', html)
    
    # Listas
    def itemize_replace(m):
        items = m.group(1)
        items_html = re.sub(r'\\item\s*(.*?)(?=\\item|$)', r'<li>\1</li>', items, flags=re.DOTALL)
        return f'<ul>{items_html}</ul>'
    html = re.sub(r'\\begin\{itemize\}(.*?)\\end\{itemize\}', itemize_replace, html, flags=re.DOTALL)
    
    def enumerate_replace(m):
        items = m.group(1)
        items_html = re.sub(r'\\item\s*(.*?)(?=\\item|$)', r'<li>\1</li>', items, flags=re.DOTALL)
        return f'<ol>{items_html}</ol>'
    html = re.sub(r'\\begin\{enumerate\}(.*?)\\end\{enumerate\}', enumerate_replace, html, flags=re.DOTALL)
    
    # Tablas simplificadas
    def table_replace(m):
        inner = m.group(1)
        # Extraer caption
        caption = ""
        cap_match = re.search(r'\\caption\{(.*?)\}', inner)
        if cap_match:
            caption = f'<caption>{cap_match.group(1)}</caption>'
        
        # Extraer contenido tabular
        tab_match = re.search(r'\\begin\{tabular\}.*?\n(.*?)\\end\{tabular\}', inner, re.DOTALL)
        if not tab_match:
            return inner
        tab_content = tab_match.group(1)
        
        rows = tab_content.strip().split('\\\\')
        html_rows = []
        for i, row in enumerate(rows):
            row = row.strip()
            if not row or row in ('\\toprule', '\\midrule', '\\bottomrule'):
                continue
            row = row.replace('\\toprule', '').replace('\\midrule', '').replace('\\bottomrule', '').strip()
            if not row:
                continue
            cells = [c.strip() for c in row.split('&')]
            tag = 'th' if i == 0 else 'td'
            cells_html = ''.join(f'<{tag}>{c}</{tag}>' for c in cells)
            row_html: str = f'<tr>{cells_html}</tr>'
            html_rows.append(row_html)
        
        return f'<table>{caption}{"".join(html_rows)}</table>'
    
    html = re.sub(r'\\begin\{table\}\[H?\]?(.*?)\\end\{table\}', table_replace, html, flags=re.DOTALL)
    
    # Limpiar comandos LaTeX restantes
    html = re.sub(r'\\newpage', '<hr/>', html)
    html = re.sub(r'\\tableofcontents', '', html)
    html = re.sub(r'\\centering', '', html)
    html = re.sub(r'\\vspace\*?\{[^}]*\}', '', html)
    html = re.sub(r'\\vfill', '', html)
    html = re.sub(r'\\\\(\[[\d.]+cm\])?', '<br/>', html)
    html = re.sub(r'\\noindent', '', html)
    html = re.sub(r'\\hline', '', html)
    html = re.sub(r'\\includegraphics\[.*?\]\{(.*?)\}', r'<img src="\1" style="max-width:100%"/>', html)
    html = re.sub(r'\\href\{(.*?)\}\{(.*?)\}', r'<a href="\1">\2</a>', html)
    html = re.sub(r'\\url\{(.*?)\}', r'<a href="\1">\1</a>', html)
    html = re.sub(r'\\cite\{(.*?)\}', r'[\1]', html)
    html = re.sub(r'%.*?\n', '\n', html)  # comments
    html = re.sub(r'~', '&nbsp;', html)
    html = re.sub(r'---', '—', html)
    html = re.sub(r'--', '–', html)
    
    # Wrap plain paragraphs
    lines = html.split('\n')
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('<') or stripped.startswith('\\'):
            result.append(stripped)
        else:
            result.append(f'<p>{stripped}</p>')
    
    return '\n'.join(result)


# ── Conversión HTML → LaTeX para persistencia ──
def html_to_latex(html: str) -> str:
    """Convierte HTML del editor Tiptap a LaTeX."""
    import re
    latex = html
    
    # Headings
    latex = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\\section{\1}', latex)
    latex = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\\subsection{\1}', latex)
    latex = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\\subsubsection{\1}', latex)
    
    # Text formatting
    latex = re.sub(r'<strong>(.*?)</strong>', r'\\textbf{\1}', latex)
    latex = re.sub(r'<b>(.*?)</b>', r'\\textbf{\1}', latex)
    latex = re.sub(r'<em>(.*?)</em>', r'\\textit{\1}', latex)
    latex = re.sub(r'<i>(.*?)</i>', r'\\textit{\1}', latex)
    latex = re.sub(r'<u>(.*?)</u>', r'\\underline{\1}', latex)
    
    # Lists
    def ul_replace(m):
        items = m.group(1)
        items_latex = re.sub(r'<li>(.*?)</li>', r'  \\item \1\n', items, flags=re.DOTALL)
        return f'\\begin{{itemize}}\n{items_latex}\\end{{itemize}}'
    latex = re.sub(r'<ul>(.*?)</ul>', ul_replace, latex, flags=re.DOTALL)
    
    def ol_replace(m):
        items = m.group(1)
        items_latex = re.sub(r'<li>(.*?)</li>', r'  \\item \1\n', items, flags=re.DOTALL)
        return f'\\begin{{enumerate}}\n{items_latex}\\end{{enumerate}}'
    latex = re.sub(r'<ol>(.*?)</ol>', ol_replace, latex, flags=re.DOTALL)
    
    # Paragraphs
    latex = re.sub(r'<p>(.*?)</p>', r'\1\n\n', latex)
    
    # Breaks
    latex = re.sub(r'<br\s*/?>', r'\\\\\n', latex)
    latex = re.sub(r'<hr\s*/?>', r'\\newpage\n', latex)
    
    # Links
    latex = re.sub(r'<a href="(.*?)">(.*?)</a>', r'\\href{\1}{\2}', latex)
    
    # Images
    latex = re.sub(r'<img[^>]*src="(.*?)"[^>]*/>', r'\\includegraphics[width=\\textwidth]{\1}', latex)
    
    # Tables (basic)
    def table_replace(m):
        content = m.group(1)
        rows = re.findall(r'<tr>(.*?)</tr>', content, re.DOTALL)
        if not rows:
            return content
        
        # Count columns from first row
        first_cells = re.findall(r'<t[hd]>(.*?)</t[hd]>', rows[0])
        cols = len(first_cells)
        col_spec = '|'.join(['l'] * cols)
        
        latex_rows = []
        for i, row in enumerate(rows):
            cells = re.findall(r'<t[hd]>(.*?)</t[hd]>', row)
            latex_row = ' & '.join(cells) + ' \\\\'
            if i == 0:
                latex_rows.append('\\toprule')
                lr: str = latex_row
                latex_rows.append(lr)
                latex_rows.append('\\midrule')
            else:
                lr2: str = latex_row
                latex_rows.append(lr2)
        latex_rows.append('\\bottomrule')
        
        return f'\\begin{{table}}[H]\n\\centering\n\\begin{{tabular}}{{@{{}}{col_spec}@{{}}}}\n' + '\n'.join(latex_rows) + f'\n\\end{{tabular}}\n\\end{{table}}'
    
    latex = re.sub(r'<table>(.*?)</table>', table_replace, latex, flags=re.DOTALL)
    
    # Strip remaining HTML tags
    latex = re.sub(r'<[^>]+>', '', latex)
    
    # Escape special LaTeX characters that might be in content
    # (don't escape backslashes or braces since those are LaTeX commands)
    for char in ['#', '$', '%', '&', '_']:
        latex = latex.replace(char, '\\' + char)
    
    return latex.strip()


# [LIBRARY] 2. Agente de Contexto
@logfire.instrument("Librarian Node")
async def librarian_node(state: AgentState):
    print("--- CONSULTANDO CONTEXTO LEGAL/HISTÓRICO ---")
    committee: str = str(state.get("committee", "")).upper()
    
    context = [
        "Carta de las Naciones Unidas, Capítulo VI: Arreglo pacífico de controversias.",
        "Resolución 75/1 de la Asamblea General: Declaración sobre la conmemoración del 75º aniversario de la ONU."
    ]
    
    if "SEGURIDAD" in committee or "SECURITY" in committee:
        context.append("Resolución 1373 (2001) del Consejo de Seguridad sobre amenazas a la paz.")
        context.append("Estatuto de Roma de la Corte Penal Internacional.")
    elif "DERECHOS" in committee or "HUMAN" in committee:
        context.append("Declaración Universal de los Derechos Humanos.")
        context.append("Pacto Internacional de Derechos Civiles y Políticos.")
    elif "AMBIENTE" in committee or "ENVIRONMENT" in committee or "PNUMA" in committee:
        context.append("Acuerdo de París sobre el cambio climático.")
        context.append("Agenda 2030 para el Desarrollo Sostenible (ODS 13).")
    
    state["legal_context"] = context
    return state

# [WRITE] 3. Agente Redactor — Genera LaTeX
@logfire.instrument("Scribe Node")
async def scribe_node(state: AgentState):
    doc_type: str = str(state.get("document_type", "RESOLUTION"))
    print(f"--- REDACTANDO DOCUMENTO LaTeX ({doc_type}) PARA {state['country']} ---")
    
    # Cargar plantilla y formatos
    template = load_latex_template(doc_type)
    formats_text = ""
    try:
        with open("MUN_DOCUMENT_FORMATS.md", "r", encoding="utf-8") as f:
            formats_text = f.read()
    except Exception:
        print("Warning: MUN_DOCUMENT_FORMATS.md not found.")

    feedback_text = ""
    if state.get("errors"):
        feedback_text = f"\n\nATENCION: El borrador anterior fue RECHAZADO. Corrige los siguientes errores:\n{chr(10).join(state['errors'])}\n"

    prompt = f"""Eres un embajador experto ante las Naciones Unidas. Tu misión es redactar un documento diplomático de altísimo nivel académico y formal para la simulación MUN.
    
    TODA LA REDACCIÓN DEBE SER EXCLUSIVAMENTE EN ESPAÑOL (Castellano). No uses inglés bajo ninguna circunstancia en el cuerpo del documento.
    
    DETALLES DEL DOCUMENTO:
    - País: {state['country']}
    - Comité: {state['committee']}
    - Tipo: {doc_type}
    - Tema: {state['topic']}
    
    {feedback_text}
    
    INVESTIGACIÓN RECIENTE (Tradúcela mentalmente al español para la redacción):
    {chr(10).join(state['research_data'])}
    
    CONTEXTO LEGAL:
    {chr(10).join(state['legal_context'])}
    
    REGLAS DE FORMATO (Respetar estrictamente):
    {formats_text}
    
    PLANTILLA LaTeX BASE:
    {template}
    
    INSTRUCCIONES CRÍTICAS:
    1. GENERA UN DOCUMENTO LaTeX COMPLETO y profesional.
    2. REDACCIÓN 100% EN ESPAÑOL DIPLOMÁTICO.
    3. Reemplaza TODOS los placeholders <<...>>.
    4. Usa un tono oficial, solemne y preciso.
    5. Desarrolla propuestas realistas alineadas con la soberanía de {state['country']}.
    6. NO devuelvas bloques de código ```markdown o explicaciones. Devuelve EL CÓDIGO LaTeX directamente.
    """
    
    response = scribe_llm.invoke([
        SystemMessage(content="Eres un Scribe diplomático de la ONU que redacta EXCLUSIVAMENTE EN ESPAÑOL. Tu salida es ÚNICAMENTE código LaTeX."),
        HumanMessage(content=prompt)
    ])
    
    latex_content = response.content.strip()
    
    import re
    latex_content = re.sub(r"^```(?:latex|tex|)\n(.*?)```$", r"\1", latex_content, flags=re.DOTALL | re.IGNORECASE).strip()
    
    state["draft"] = latex_content
    state["draft_html"] = latex_to_html(latex_content)
    print("[OK] Borrador LaTeX generado exitosamente.")
    return state

# [VALIDATE] 4. Agente Validador
@logfire.instrument("Validator Node")
async def validator_node(state: AgentState):
    print("--- VALIDANDO PROTOCOLO Y FORMATO LaTeX ---")
    
    formats_text = ""
    try:
        with open("MUN_DOCUMENT_FORMATS.md", "r", encoding="utf-8") as f:
            formats_text = f.read()
    except Exception:
        pass

    prompt = f"""Analiza el siguiente documento LaTeX MUN y verifica:
1. ¿Compila correctamente? (verifica que \\begin y \\end estén balanceados, y que termine en \\end{{document}})
2. ¿Cumple el formato descrito en las REGLAS DE FORMATO para {state.get('document_type', 'POSITION_PAPER')}?
3. ¿Está en español formal?
4. ¿Es coherente con el tema: {state['topic']}?

REGLAS DE FORMATO:
{formats_text}

DOCUMENTO LaTeX:
{state['draft']}

Si el documento es completamente apto y compila, responde ÚNICAMENTE con la palabra 'VALID'.
Si tiene errores críticos de compilación LaTeX o no cumple las REGLAS DE FORMATO, enumera los errores específicos brevemente.
"""
    
    response = critic_llm.invoke([
        SystemMessage(content="Eres un revisor de protocolos de las Naciones Unidas y experto en LaTeX. Eres estricto pero justo. Si el documento cumple razonablemente y compila, responde VALID."),
        HumanMessage(content=prompt)
    ])
    
    feedback = response.content.strip()
    if "VALID" in feedback.upper() and len(feedback) < 10:
        state["is_valid"] = True
        state["errors"] = []
        print("[OK] Documento LaTeX validado.")
    else:
        state["is_valid"] = False
        state["errors"] = [feedback]
        print("[WARN] El documento requiere correcciones.")
    
    return state

# [STRATEGY] 5. Agente Estratega
@logfire.instrument("Negotiator Node")
async def negotiator_node(state: AgentState):
    print("--- GENERANDO GUÍA ESTRATÉGICA Y ALIANZAS ---")
    
    prompt = f"""Basado en este documento redactado por {state['country']} sobre {state['topic']},
    genera una guía estratégica para el delegado:
    1. Identifica 3 países/bloques que apoyen esta posición.
    2. Identifica 3 países/bloques que se opongan.
    3. Sugiere 2 puntos de negociación donde se pueda ceder.
    
    DOCUMENTO:
    {str(state['draft'])[:2000]}
    """
    
    response = critic_llm.invoke([
        SystemMessage(content="Eres un estratega geopolítico senior."),
        HumanMessage(content=prompt)
    ])
    
    state["strategy_guide"] = response.content
    print("[OK] Guía estratégica generada.")
    return state

# --- [GRAPH] CONSTRUCCIÓN DEL GRAFO ---
workflow = StateGraph(AgentState)

workflow.add_node("researcher", researcher_node)
workflow.add_node("librarian", librarian_node)
workflow.add_node("scribe", scribe_node)
workflow.add_node("validator", validator_node)
workflow.add_node("negotiator", negotiator_node)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "librarian")
workflow.add_edge("librarian", "scribe")
workflow.add_edge("scribe", "validator")

workflow.add_conditional_edges(
    "validator",
    lambda x: "valid" if x["is_valid"] else "invalid",
    {
        "valid": "negotiator",
        "invalid": "scribe"
    }
)

workflow.add_edge("negotiator", END)

app = workflow.compile()

print("Grafo de Agentes MUNify configurado correctamente.")
