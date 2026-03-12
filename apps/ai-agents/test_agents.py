import asyncio
import os
from main import app

async def run_full_munify_flow():
    # Parámetros de la simulación
    inputs = {
        "topic": "The situation in the Middle East, including the Palestinian question",
        "country": "Germany",
        "committee": "Security Council",
        "document_type": "POSITION_PAPER",
        "research_data": [],
        "legal_context": [],
        "draft": "",
        "is_valid": False,
        "errors": [],
        "strategy_guide": ""
    }
    
    print(f"INICIANDO FLUJO COMPLETO PARA: {inputs['country']} en {inputs['committee']}")
    print(f"TEMA: {inputs['topic']}\n")
    print("="*50)

    async for output in app.astream(inputs, {"recursion_limit": 10}):
        for node_name, state in output.items():
            print(f"\n- NODO: {node_name.upper()} -")
            
            if node_name == "researcher":
                print(f"   - Fuentes encontradas: {len(state['research_data'])}")
                if state['research_data']:
                    print(f"   - Primera fuente: {state['research_data'][0][:150].encode('ascii', 'ignore').decode('ascii')}...")
            
            elif node_name == "scribe":
                print(f"   - Borrador redactado (Fragmento):\n{state['draft'][:500].encode('ascii', 'ignore').decode('ascii')}...")
            
            elif node_name == "validator":
                status = "VALIDO" if state['is_valid'] else "INVALIDO"
                print(f"   - Estado: {status}")
                if state['errors']:
                    error_report = state['errors'][0] if isinstance(state['errors'][0], str) else str(state['errors'][0])
                    print(f"   - Reporte: {error_report.encode('ascii', 'ignore').decode('ascii')}")
            
            elif node_name == "negotiator":
                strat = state['strategy_guide']
                print(f"   - Estrategia Generada:\n{strat.encode('ascii', 'ignore').decode('ascii')}")

    print("\n" + "="*50)
    print("FLUJO FINALIZADO")

if __name__ == "__main__":
    if not os.getenv("TAVILY_API_KEY") or not os.getenv("NVIDIA_API_KEY"):
        print("❌ ERROR: Faltan API Keys en el archivo .env")
    else:
        asyncio.run(run_full_munify_flow())
