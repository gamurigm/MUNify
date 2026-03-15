import json
import uuid
import logfire
from typing import Optional, Any, Dict
from services.semantic_cache import semantic_cache

class JobStore:
    """
    Handles background job state and results using Redis.
    Shared across API workers.
    """
    
    @staticmethod
    def create_job(job_type: str) -> str:
        job_id = f"job_{job_type}_{uuid.uuid4().hex[:8]}"
        if semantic_cache.client:
            semantic_cache.client.setex(f"job:{job_id}:status", 7200, "queued") # 2 hours TTL
        return job_id

    @staticmethod
    def update_status(job_id: str, status: str, result: Optional[Any] = None, error: Optional[str] = None):
        if not semantic_cache.client:
            return
        
        pipe = semantic_cache.client.pipeline()
        pipe.setex(f"job:{job_id}:status", 7200, status)
        
        if result:
            pipe.setex(f"job:{job_id}:result", 7200, json.dumps(result))
        if error:
            pipe.setex(f"job:{job_id}:error", 7200, error)
            
        pipe.execute()
        logfire.info(f"Job {job_id} updated to {status}")

    @staticmethod
    def get_job(job_id: str) -> Dict[str, Any]:
        if not semantic_cache.client:
            return {"status": "error", "message": "Redis unavailable"}
        
        status = semantic_cache.client.get(f"job:{job_id}:status")
        if not status:
            return {"status": "not_found"}
            
        error = semantic_cache.client.get(f"job:{job_id}:error")
        result_raw = semantic_cache.client.get(f"job:{job_id}:result")
        
        result = None
        if result_raw:
            try:
                result = json.loads(result_raw)
            except:
                result = result_raw

        return {
            "job_id": job_id,
            "status": status,
            "error": error,
            "result": result
        }

job_store = JobStore()
