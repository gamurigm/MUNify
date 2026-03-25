# pyre-ignore-all-errors
import re
# pyre-ignore[21]
import logfire
# pyre-ignore[21]
from langchain_core.messages import HumanMessage, SystemMessage

# pyre-ignore[21]
from domain.state import AgentState
# pyre-ignore[21]
from services.llm import tavily, scribe_llm, critic_llm
# pyre-ignore[21]
from services.knowledge_base import knowledge_base
# pyre-ignore[21]
from utils.converters import load_latex_template, latex_to_html
# pyre-ignore[21]
from utils.resolution_parser import resolution_ast
# pyre-ignore[21]
from notebook_service import notebook_service
# from services.knowledge_graph import knowledge_graph  # Desactivado a petición del usuario

# [SEARCH] 1. Agente Investigador (Tavily)
@logfire.instrument("Researcher Node")
async def researcher_node(state: AgentState):
    print(f"--- INVESTIGANDO CON TAVILY SOBRE: {state['topic']} ---")
    
    query = f"recent news and geopolitical position of {state['country']} on {state['topic']}"
    search_result = tavily.search(query=query, search_depth="advanced", max_results=35)
    
    context = [res['content'] for res in search_result['results']]
    
    state["research_data"] = context
    print(f"[OK] Se encontraron {len(context)} fuentes relevantes.")
    return state


# [LIBRARY] 2. Agente de Contexto
@logfire.instrument("Librarian Node")
async def librarian_node(state: AgentState):
    print("--- CONSULTANDO CONTEXTO LEGAL/HISTÓRICO (Knowledge Base) ---")
    committee = str(state.get("committee", "")).upper()
    topic = state["topic"]
    
    # --- RAG: Consulta a la base de conocimiento de tratados ---
    search_query = f"{committee} {topic}"
    legal_context = knowledge_base.search(search_query)
    
    context = [
        "Capítulo VI de la Carta de la ONU: Arreglo pacífico de controversias.",
    ] + legal_context
    
    if "SEGURIDAD" in committee or "SECURITY" in committee:
        context.append("Resolución 1373 (2001) del Consejo de Seguridad.")
    elif "DERECHOS" in committee or "HUMAN" in committee:
        context.append("Pacto Internacional de Derechos Civiles y Políticos.")
    elif "AMBIENTE" in committee or "ENVIRONMENT" in committee or "PNUMA" in committee:
        context.append("Acuerdo de París sobre el cambio climático.")
        context.append("Agenda 2030 para el Desarrollo Sostenible (ODS 13).")
    
    # --- NUEVA CAPA: Ingesta de NotebookLM ---
    if state.get("notebook_id"):
        print(f"--- CONSULTANDO NOTEBOOKLM ({state['notebook_id']}) ---")
        prompt = f"Proporciona contexto legal, histórico y resoluciones previas relevantes para {state['topic']} desde la perspectiva de {state['country']} en el comité {state['committee']}."
        try:
            nlm_context = await notebook_service.query_notebook(state["notebook_id"], prompt)
            context.append(f"CONTEXTO PROFESIONAL (NotebookLM):\n{nlm_context}")
        except Exception as e:
            print(f"Error consultando NotebookLM: {e}")

    # --- CAPA DESACTIVADA: Knowledge Graph (Neo4j) ---
    # try:
    #     country = state.get("country", "")
    #     related_treaties = knowledge_graph.get_related_treaties(country)
    #     if related_treaties:
    #         treaties_str = ", ".join(related_treaties)
    #         context.append(f"TRATADOS VINCULANTES PARA {country.upper()}: {treaties_str}")
    # except Exception as e:
    #     print(f"Error consultando Knowledge Graph: {e}")

    print(f"[OK] Se encontraron {len(legal_context)} documentos legales relevantes.")
    return {"legal_context": context}


# [WRITE] 3. Agente Redactor — Genera LaTeX
@logfire.instrument("Scribe Node")
async def scribe_node(state: AgentState):
    doc_type = str(state.get("document_type", "RESOLUTION"))
    print(f"--- REDACTANDO DOCUMENTO LaTeX ({doc_type}) PARA {state['country']} ---")
    
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
    latex_content = re.sub(r"^```(?:latex|tex|)\n(.*?)```$", r"\1", latex_content, flags=re.DOTALL | re.IGNORECASE).strip()
    
    draft = latex_content
    draft_html = latex_to_html(latex_content)
    print("[OK] Borrador LaTeX generado exitosamente.")
    return {
        "draft": draft,
        "draft_html": draft_html,
    }


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
    
    # --- NUEVA CAPA: Validación AST Estructural ---
    ast_result = resolution_ast.validate_structure(state['draft'])
    ast_errors = ast_result.get("errors", [])
    
    response = critic_llm.invoke([
        SystemMessage(content="Eres un revisor de protocolos de las Naciones Unidas y experto en LaTeX. Eres estricto pero justo. Si el documento cumple razonablemente y compila, responde VALID."),
        HumanMessage(content=prompt)
    ])
    
    feedback = response.content.strip()
    
    # Combinar validación LLM con validación AST
    if "VALID" in feedback.upper() and len(feedback) < 10 and not ast_errors:
        state["is_valid"] = True
        state["errors"] = []
        print("[OK] Documento LaTeX validado (Física + Estructura AST).")
    else:
        state["is_valid"] = False
        all_errors = ast_errors + ([feedback] if "VALID" not in feedback.upper() else [])
        state["errors"] = all_errors
        print(f"[WARN] El documento requiere correcciones. Errores AST: {len(ast_errors)}")
    
    return state


# [STRATEGY] 5. Agente Estratega
@logfire.instrument("Negotiator Node")
async def negotiator_node(state: AgentState):
    print("--- GENERANDO GUÍA ESTRATÉGICA Y ALIANZAS ---")
    
    draft_text_str = str(state.get("draft", ""))
    country = state.get("country", "Unknown")
    topic = state.get("topic", "Unknown")
    # pyre-ignore[6, 16]
    doc_preview = draft_text_str[:2000]
    prompt = f"""Basado en este documento redactado por {country} sobre {topic},
    genera una guía estratégica para el delegado:
    1. Identifica 3 países/bloques que apoyen esta posición.
    2. Identifica 3 países/bloques que se opongan.
    3. Sugiere 2 puntos de negociación donde se pueda ceder.
    
    DOCUMENTO:
    {doc_preview}
    """
    
    response = critic_llm.invoke([
        SystemMessage(content="Eres un estratega geopolítico senior."),
        HumanMessage(content=prompt)
    ])
    
    state["strategy_guide"] = response.content
    print("[OK] Guía estratégica generada.")
    return state
