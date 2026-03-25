# pyre-ignore[21]
import logfire

class KnowledgeGraphService:
    def __init__(self):
        logfire.info("Knowledge Graph (Neo4j) deshabilitado.")

    def close(self):
        pass

    def add_relation(self, country: str, treaty: str, relation_type: str = "SIGNED"):
        pass

    def get_related_treaties(self, country: str) -> list:
        return []

knowledge_graph = KnowledgeGraphService()
