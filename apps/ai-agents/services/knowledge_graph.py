import os
from neo4j import GraphDatabase
import logfire

class KnowledgeGraphService:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            logfire.info("Conectado a Neo4j Knowledge Graph")
        except Exception as e:
            logfire.error(f"Error conectando a Neo4j: {e}")

    def close(self):
        if self.driver:
            self.driver.close()

    def add_relation(self, country: str, treaty: str, relation_type: str = "SIGNED"):
        """Crea una relación entre un país y un tratado."""
        with self.driver.session() as session:
            session.execute_write(self._create_relation, country, treaty, relation_type)

    @staticmethod
    def _create_relation(tx, country, treaty, relation_type):
        query = (
            "MERGE (c:Country {name: $country}) "
            "MERGE (t:Treaty {title: $treaty}) "
            f"MERGE (c)-[:{relation_type}]->(t)"
        )
        tx.run(query, country=country, treaty=treaty)

    def get_related_treaties(self, country: str) -> list:
        """Obtiene tratados relacionados con un país."""
        with self.driver.session() as session:
            result = session.execute_read(self._find_treaties, country)
            return [record["treaty"] for record in result]

    @staticmethod
    def _find_treaties(tx, country):
        query = (
            "MATCH (c:Country {name: $country})-[:SIGNED|MEMBER]->(t:Treaty) "
            "RETURN t.title AS treaty"
        )
        return tx.run(query, country=country)

knowledge_graph = KnowledgeGraphService()
