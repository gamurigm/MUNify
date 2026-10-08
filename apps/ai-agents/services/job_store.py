import json
import uuid
import logfire
from typing import Optional, Any, Dict

# In-memory store for AI agent jobs (replaces Redis)
# Since FastAPI runs in a single process with background tasks in this architecture, 
# a global dictionary is sufficient for job tracking.
_JOBS_DB: Dict[str, Dict[str, Any]] = {}

class JobStore:
    """
    Handles background job state and results using an in-memory dictionary.
    Shared across the API process.
    """
    
    @staticmethod
    def create_job(job_type: str) -> str:
        job_id = f"job_{job_type}_{uuid.uuid4().hex[:8]}"
        _JOBS_DB[job_id] = {
            "status": "queued",
            "result": None,
            "error": None
        }
        return job_id

    @staticmethod
    def update_status(job_id: str, status: str, result: Optional[Any] = None, error: Optional[str] = None):
        if job_id not in _JOBS_DB:
            _JOBS_DB[job_id] = {}
            
        _JOBS_DB[job_id]["status"] = status
        
        if result is not None:
            _JOBS_DB[job_id]["result"] = result
        if error is not None:
            _JOBS_DB[job_id]["error"] = error
            
        logfire.info(f"Job {job_id} updated to {status}")

    @staticmethod
    def get_job(job_id: str) -> Dict[str, Any]:
        if job_id not in _JOBS_DB:
            return {"status": "not_found"}
            
        job = _JOBS_DB[job_id]
        return {
            "job_id": job_id,
            "status": job.get("status"),
            "error": job.get("error"),
            "result": job.get("result")
        }

job_store = JobStore()
