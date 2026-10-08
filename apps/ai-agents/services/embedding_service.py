import logfire
from typing import List, Union
from transformers import AutoTokenizer
from optimum.onnxruntime import ORTModelForFeatureExtraction
import numpy as np

class EmbeddingService:
    """
    Servicio dedicado para generación de embeddings. 
    Usa ONNX Runtime (Optimum) para reducir tamaño de VENV y acelerar CPU inference.
    """
    _instance = None
    _model = None
    _tokenizer = None

    def __init__(self):
        if not EmbeddingService._model:
            logfire.info("Iniciando Microservicio de Embeddings (ONNX: intfloat/multilingual-e5-small)")
            model_id = 'intfloat/multilingual-e5-small'
            
            EmbeddingService._tokenizer = AutoTokenizer.from_pretrained(model_id)
            # Use onnx model directly
            EmbeddingService._model = ORTModelForFeatureExtraction.from_pretrained(model_id, export=True)

    def encode(self, texts: Union[str, List[str]], prefix: str = "pasaje: ") -> List[List[float]]:
        if isinstance(texts, str):
            texts = [texts]
        
        # El modelo e5 requiere prefijos para optimalidad
        prefixed_texts = [f"{prefix}{t}" for t in texts]
        
        inputs = EmbeddingService._tokenizer(prefixed_texts, padding=True, truncation=True, return_tensors="np")
        outputs = EmbeddingService._model(**inputs)
        
        # Mean pooling con Numpy
        attention_mask = inputs['attention_mask']
        token_embeddings = outputs.last_hidden_state
        
        # Expandir attention mask al tamaño de los embeddings
        input_mask_expanded = np.expand_dims(attention_mask, -1).repeat(token_embeddings.shape[-1], axis=-1)
        
        # Calcular suma ponderada de embeddings
        sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
        sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
        
        # Retornar lista de floats regulares
        return (sum_embeddings / sum_mask).tolist()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

# Singleton
embedding_service = EmbeddingService.get_instance()
