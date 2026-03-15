
import traceback
import sys

print("--- DIAGNOSTIC START ---")
try:
    print("Step 1: Importing domain.state")
    from domain.state import AgentState
    
    print("Step 2: Importing services.embedding_service")
    from services.embedding_service import embedding_service
    
    print("Step 3: Importing services.knowledge_base")
    from services.knowledge_base import knowledge_base
    
    print("Step 4: Importing services.semantic_cache")
    from services.semantic_cache import semantic_cache
    
    print("Step 5: Importing services.llm")
    from services.llm import scribe_llm
    
    print("Step 6: Importing nodes.agent_nodes")
    from nodes.agent_nodes import scribe_node
    
    print("Step 7: Importing main")
    from main import app
    
    print("--- DIAGNOSTIC SUCCESS ---")
except Exception as e:
    print("\n!!! DIAGNOSTIC FAILED !!!")
    traceback.print_exc()
    sys.exit(1)
