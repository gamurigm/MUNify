# pyre-ignore-all-errors
import logfire
from langchain_core.messages import HumanMessage, SystemMessage
from domain.state import AgentState
from services.llm import tavily, fast_llm, critic_llm
import json

# 1. PLANNER: Genera sub-consultas de investigación
@logfire.instrument("Research Planner Node")
async def research_planner_node(state: AgentState):
    topic = state['topic']
    country = state['country']
    
    # MODO ESTÁNDAR: Evita el loop pesado si el usuario no activó Deep Research
    if not state.get("deep_research"):
        state["research_queries"] = [f"recent geopolitical position of {country} on {topic}"]
        state["iteration_count"] = 0
        state["research_data"] = []
        print("[OK] Modo investigación estándar seleccionado.")
        return state

    print(f"--- PLANIFICANDO INVESTIGACIÓN PROFUNDA PARA: {topic} ---")
    
    prompt = f"""Como experto en investigación geopolítica del MUN, analiza el tema: "{topic}" para el país "{country}".
    Genera una lista de 5 a 8 consultas de búsqueda específicas en INGLÉS que cubran:
    1. Postura histórica oficial de {country} sobre {topic}.
    2. Declaraciones recientes de líderes de {country} en la Asamblea General o foros internacionales.
    3. Alianzas regionales y tratados firmados por {country} relacionados con el tema.
    4. Críticas o controversias internacionales que involucren a {country} sobre este tema.
    5. Datos estadísticos y económicos reales de {country} impactados por el tema.

    Responde ÚNICAMENTE con un array JSON de strings. Ejemplo: ["query 1", "query 2"]
    """
    
    response = fast_llm.invoke([
        SystemMessage(content="Eres un planificador de investigación diplomática. Respondes exclusivamente en formato JSON."),
        HumanMessage(content=prompt)
    ])
    
    try:
        # Extraer JSON de la respuesta
        text = response.content.replace('```json', '').replace('```', '').strip()
        queries = json.loads(text)
        state["research_queries"] = queries
        state["iteration_count"] = 0
        state["research_data"] = []
        print(f"[OK] Plan de investigación generado con {len(queries)} consultas.")
    except Exception as e:
        print(f"[ERROR] Fallo al parsear preguntas de investigación: {e}")
        state["research_queries"] = [f"{country} official position on {topic}"]
        state["iteration_count"] = 0
        state["research_data"] = []
    
    return state

# 2. EXECUTOR: Ejecuta las búsquedas en paralelo (o secuencial en este nodo)
@logfire.instrument("Research Executor Node")
async def research_executor_node(state: AgentState):
    print(f"--- EJECUTANDO INVESTIGACIÓN (Iteración {state['iteration_count'] + 1}) ---")
    
    queries = state["research_queries"]
    results = []
    
    # En un entorno real usaríamos asyncio.gather, aquí para simplicidad y control:
    for q in queries:
        try:
            print(f"Buscando: {q}")
            search_depth = "advanced" if state["iteration_count"] == 0 else "basic"
            search_res = tavily.search(query=q, search_depth=search_depth, max_results=5)
            for r in search_res['results']:
                results.append(f"FUENTE: {r['url']}\nCONTENIDO: {r['content']}")
        except Exception as e:
            print(f"Error en búsqueda '{q}': {e}")
            
    state["research_data"].extend(results)
    state["iteration_count"] += 1
    return state

# 3. SYNTHESIZER: Evalúa y decide si profundizar o terminar
@logfire.instrument("Research Synthesizer Node")
async def research_synthesizer_node(state: AgentState):
    print("--- SINTETIZANDO INVESTIGACIÓN Y MEMORIA PERMANENTE ---")
    
    data_len = len(state["research_data"])
    if data_len < 10 and state["iteration_count"] < 2:
        print("[RE-TRY] Datos insuficientes, generando consultas de refuerzo...")
        return state
        
    # --- NUEVA CAPA: Memoria Permanente (ML Analysis) ---
    from services.knowledge_base import knowledge_base
    
    print(f"--- Guardando {min(5, data_len)} fragmentos clave en memoria permanente ---")
    # Guardamos solo los más relevantes o los primeros para no saturar, 
    # en una implementación real filtraríamos por redundancia
    for fragment in state["research_data"][:5]:
        try:
            # Extraer URL si existe en el string formateado
            source = "Web Research"
            if "FUENTE: " in fragment:
                source = fragment.split("\n")[0].replace("FUENTE: ", "")
                content = fragment.split("CONTENIDO: ")[1]
            else:
                source = "Web Research"
                content = fragment
                
            knowledge_base.add_web_knowledge(source, content)
        except Exception as e:
            print(f"Error persistiendo fragmento: {e}")

    print(f"[OK] Investigación concluida. Conocimiento actualizado de forma permanente.")
    return state
