import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

# Ensure the current directory is in the path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import after path adjustment
from main import app as agent_workflow # pyre-ignore

async def test_flow():
    print("--- INICIANDO TEST DE FLUJO DE AGENTE CON MOCK ---")
    
    # Define mock properly for testing
    mock_nlm = AsyncMock()
    mock_nlm.query_notebook.return_value = "Este es un contexto profesional simulado para el test."

    initial_state = {
        "topic": "Desarrollo Sostenible",
        "country": "España",
        "committee": "ASAMBLEA GENERAL",
        "document_type": "POSITION_PAPER",
        "research_data": ["Dato de investigacion 1"],
        "legal_context": [],
        "draft": "",
        "draft_html": "",
        "is_valid": False,
        "errors": [],
        "strategy_guide": "",
        "notebook_id": "mock_nb_123" # Activamos el flujo de NotebookLM
    }
    
    config = {"recursion_limit": 5}
    try:
        # Pestañeamos el mock dentro de main donde se usa
        with patch("main.notebook_service", mock_nlm):
            # Ejecutamos el flujo
            result = await agent_workflow.ainvoke(initial_state, config)
            
            print(f"OK: Flujo completado.")
            print(f"Draft generado (parcial): {result.get('draft')[:100]}...")
            
            # Verificar que se llamó al mock
            if mock_nlm.query_notebook.called:
                print("OK: El Agente Bibliotecario consulto NotebookLM correctamente.")
            else:
                print("FALLO: El Agente Bibliotecario NO consulto NotebookLM.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_flow())
