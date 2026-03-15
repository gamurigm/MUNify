# pyre-ignore-all-errors
import logfire
from sentence_transformers import SentenceTransformer
from typing import List, Union

class EmbeddingService:
    """
    Servicio dedicado para generación de embeddings. 
    En una arquitectura de microservicios, este archivo sería el cliente 
    hacia un contenedor de NVIDIA Triton o un servicio FastAPI aparte.
    """
    _instance = None
    _model = None

    def __init__(self):
        if not EmbeddingService._model:
            logfire.info("Iniciando Microservicio de Embeddings (Local Model: intfloat/multilingual-e5-small)")
            EmbeddingService._model = SentenceTransformer('intfloat/multilingual-e5-small')

    def encode(self, texts: Union[str, List[str]], prefix: str = "pasaje: ") -> List[List[float]]:
        if isinstance(texts, str):
            texts = [texts]
        
        # El modelo e5 requiere prefijos para optimalidad
        prefixed_texts = [f"{prefix}{t}" for t in texts]
        embeddings = EmbeddingService._model.encode(prefixed_texts)
        return embeddings.tolist()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

# Singleton
embedding_service = EmbeddingService.get_instance()
