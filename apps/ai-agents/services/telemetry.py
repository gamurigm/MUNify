import time
import logfire
from dataclasses import dataclass, field
from typing import Dict, List, Any
import json
from services.semantic_cache import semantic_cache

@dataclass
class NodeStats:
    calls: int = 0
    total_latency: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0

class TelemetryService:
    """
    Tracks agent performance, costs, and latencies.
    Data is stored in-memory for the current session and can be persisted to Redis.
    """
    def __init__(self):
        self.node_stats: Dict[str, NodeStats] = {}
        self.cache_hits: int = 0
        self.cache_misses: int = 0
        self.start_time = time.time()

    def track_call(self, node_name: str, latency: float, input_tokens: int = 0, output_tokens: int = 0):
        if node_name not in self.node_stats:
            self.node_stats[node_name] = NodeStats()
        
        stats = self.node_stats[node_name]
        stats.calls += 1
        stats.total_latency += latency
        stats.input_tokens += input_tokens
        stats.output_tokens += output_tokens
        
        logfire.info(f"Telemetry: Node {node_name} - Latency: {latency:.2f}s, Tokens: {input_tokens}/{output_tokens}")

    def track_cache(self, hit: bool):
        if hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1

    def get_summary(self) -> Dict[str, Any]:
        summary = {
            "uptime": time.time() - self.start_time,
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate": self.cache_hits / (self.cache_hits + self.cache_misses) if (self.cache_hits + self.cache_misses) > 0 else 0
            },
            "nodes": {}
        }
        
        for name, stats in self.node_stats.items():
            summary["nodes"][name] = {
                "calls": stats.calls,
                "avg_latency": stats.total_latency / stats.calls if stats.calls > 0 else 0,
                "total_tokens": stats.input_tokens + stats.output_tokens,
                "input_tokens": stats.input_tokens,
                "output_tokens": stats.output_tokens
            }
            
        return summary

telemetry = TelemetryService()
