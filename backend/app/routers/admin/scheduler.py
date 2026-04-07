from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user, require_permission
from app.services.scheduler import scheduler_service

router = APIRouter(
    prefix="/api/admin/scheduler",
    tags=["Admin - Scheduler"],
    dependencies=[Depends(require_permission("system.admin"))],
)


@router.get("/jobs")
async def list_jobs():
    """Lista tutti i job schedulati con stato."""
    return await scheduler_service.get_jobs()


@router.put("/jobs/{name}/toggle")
async def toggle_job(name: str):
    """Attiva/disattiva un job."""
    try:
        return await scheduler_service.toggle_job(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/jobs/{name}/run")
async def run_job_now(name: str):
    """Esegue un job immediatamente."""
    try:
        return await scheduler_service.run_now(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/jobs/{name}/logs")
async def get_job_logs(name: str, limit: int = 20):
    """Ultimi log di esecuzione di un job."""
    return await scheduler_service.get_logs(name, limit)
