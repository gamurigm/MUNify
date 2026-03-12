# pyre-ignore-all-errors
import os
import random
from tavily import TavilyClient
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# The environment is loaded in main.py, but we can ensure it here
from dotenv import load_dotenv
from pathlib import Path
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# 🔑 Inicialización de Clientes
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# 🔑 Carga de múltiples llaves para Performance/Redundancia
NVIDIA_KEYS = [
    os.getenv("NVIDIA_API_KEY_1"),
    os.getenv("NVIDIA_API_KEY_2"),
    os.getenv("NVIDIA_API_KEY_3"),
    os.getenv("NVIDIA_API_KEY_4"),
    os.getenv("NVIDIA_API_KEY_5")
]

def get_random_key():
    valid_keys = [k for k in NVIDIA_KEYS if k]
    return random.choice(valid_keys) if valid_keys else None

# 🔑 Inicialización de modelos NVIDIA NIM con balanceo de carga
scribe_llm = ChatNVIDIA(
    model="meta/llama-3.3-70b-instruct",
    api_key=NVIDIA_KEYS[1] if len(NVIDIA_KEYS) > 1 else get_random_key(),
    temperature=0.6,
    max_tokens=4000
)

critic_llm = ChatNVIDIA(
    model="mistralai/mistral-large-3-675b-instruct-2512",
    api_key=NVIDIA_KEYS[2] if len(NVIDIA_KEYS) > 2 else get_random_key(),
    temperature=0.1,
    max_tokens=2048
)

fast_llm = ChatNVIDIA(
    model="nvidia/nemotron-3-nano-30b-a3b",
    api_key=NVIDIA_KEYS[3] if len(NVIDIA_KEYS) > 3 else get_random_key(),
    temperature=0.1
)
