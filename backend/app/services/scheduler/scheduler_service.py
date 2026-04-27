"""
Task Scheduler — gestione job schedulati con APScheduler.
I job sono definiti nel codice (JOB_REGISTRY), lo stato è nel DB.
"""
import logging
import time
from datetime import datetime, timezone
from typing import Callable, Awaitable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.scheduler import ScheduledJob, ScheduledJobLog
from app.services.scheduler import digest_service, backup_service

logger = logging.getLogger(__name__)

scheduler: AsyncIOScheduler | None = None

# ── Job Registry ─────────────────────────────────────────────────────────────
# Ogni job ha: name, description, cron, function
# La function riceve un AsyncSession e ritorna un dict con i risultati

JOB_REGISTRY: list[dict] = [
    {
        "name": "ticket_digest",
        "description": "Riepilogo giornaliero ticket aperti per ogni utente assegnato",
        "cron": "0 12 * * *",  # ogni giorno alle 12:00
        "fn": digest_service.run_digest,
    },
    {
        "name": "db_backup",
        "description": "Backup giornaliero del database PostgreSQL (ftc_hub.dump nella cartella BACKUP_PATH)",
        "cron": "0 2 * * *",  # ogni giorno alle 02:00
        "fn": backup_service.run_backup,
    },
]


async def _run_job(name: str, fn: Callable[[AsyncSession], Awaitable[dict]]):
    """Wrapper che esegue il job, logga il risultato e aggiorna il DB."""
    t0 = time.perf_counter()
    async with AsyncSessionLocal() as db:
        try:
            # Verifica se il job è attivo
            result = await db.execute(
                select(ScheduledJob).where(ScheduledJob.name == name)
            )
            job_row = result.scalar_one_or_none()
            if job_row and not job_row.is_active:
                logger.info(f"Job '{name}' è disattivato — skip")
                return

            # Esegui
            logger.info(f"Job '{name}' avviato")
            job_result = await fn(db)
            duration_ms = int((time.perf_counter() - t0) * 1000)
            detail = (job_result.get("message") if isinstance(job_result, dict) else None) or str(job_result) or "OK"

            # Logga
            log = ScheduledJobLog(
                job_name=name,
                status="ok",
                duration_ms=duration_ms,
                detail=detail[:500],
                records_affected=job_result.get("users_notified", 0) if isinstance(job_result, dict) else None,
                finished_at=datetime.now(timezone.utc),
            )
            db.add(log)

            # Aggiorna job
            if job_row:
                job_row.last_run_at = datetime.now(timezone.utc)
                job_row.last_run_status = "ok"
                job_row.last_run_duration_ms = duration_ms
                job_row.last_run_detail = detail[:500]

            await db.commit()
            logger.info(f"Job '{name}' completato in {duration_ms}ms — {detail}")

        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            logger.error(f"Job '{name}' fallito dopo {duration_ms}ms: {exc}")
            await db.rollback()

            # Logga l'errore in una nuova transazione
            try:
                log = ScheduledJobLog(
                    job_name=name,
                    status="error",
                    duration_ms=duration_ms,
                    detail=str(exc)[:500],
                    finished_at=datetime.now(timezone.utc),
                )
                db.add(log)

                # Ricarica il job per aggiornarlo
                result2 = await db.execute(
                    select(ScheduledJob).where(ScheduledJob.name == name)
                )
                job_row2 = result2.scalar_one_or_none()
                if job_row2:
                    job_row2.last_run_at = datetime.now(timezone.utc)
                    job_row2.last_run_status = "error"
                    job_row2.last_run_duration_ms = duration_ms
                    job_row2.last_run_detail = str(exc)[:500]

                await db.commit()
            except Exception as log_exc:
                logger.warning(f"Impossibile loggare errore job '{name}': {log_exc}")


async def _seed_jobs():
    """Assicura che tutti i job del registry esistano nel DB."""
    async with AsyncSessionLocal() as db:
        for job_def in JOB_REGISTRY:
            result = await db.execute(
                select(ScheduledJob).where(ScheduledJob.name == job_def["name"])
            )
            existing = result.scalars().first()
            if not existing:
                db.add(ScheduledJob(
                    name=job_def["name"],
                    description=job_def["description"],
                    cron_expression=job_def["cron"],
                    is_active=True,
                ))
                logger.info(f"Job '{job_def['name']}' registrato nel DB")
        await db.commit()


async def start():
    """Avvia lo scheduler — chiamato dal lifespan di FastAPI."""
    global scheduler
    scheduler = AsyncIOScheduler(timezone="Europe/Rome")

    await _seed_jobs()

    # Carica lo stato dei job dal DB
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScheduledJob))
        db_jobs = {j.name: j for j in result.scalars().all()}

    for job_def in JOB_REGISTRY:
        name = job_def["name"]
        db_job = db_jobs.get(name)
        if db_job and not db_job.is_active:
            logger.info(f"Job '{name}' disattivato — non schedulato")
            continue

        cron = db_job.cron_expression if db_job else job_def["cron"]
        trigger = CronTrigger.from_crontab(cron, timezone="Europe/Rome")
        scheduler.add_job(
            _run_job,
            trigger=trigger,
            args=[name, job_def["fn"]],
            id=name,
            replace_existing=True,
        )
        logger.info(f"Job '{name}' schedulato: {cron}")

    scheduler.start()
    logger.info("Task Scheduler avviato")


async def stop():
    """Ferma lo scheduler — chiamato dal lifespan di FastAPI."""
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("Task Scheduler fermato")
        scheduler = None


async def get_jobs() -> list[dict]:
    """Ritorna lo stato di tutti i job."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScheduledJob))
        jobs = result.scalars().all()

    job_fns = {j["name"] for j in JOB_REGISTRY}
    out = []
    for j in jobs:
        # Calcola prossima esecuzione
        next_run = None
        if scheduler and j.is_active:
            apjob = scheduler.get_job(j.name)
            if apjob:
                next_run = apjob.next_run_time

        out.append({
            "id": str(j.id),
            "name": j.name,
            "description": j.description,
            "cron_expression": j.cron_expression,
            "is_active": j.is_active,
            "last_run_at": j.last_run_at.isoformat() if j.last_run_at else None,
            "last_run_status": j.last_run_status,
            "last_run_duration_ms": j.last_run_duration_ms,
            "last_run_detail": j.last_run_detail,
            "next_run_at": next_run.isoformat() if next_run else None,
            "registered": j.name in job_fns,
        })
    return out


async def toggle_job(name: str) -> dict:
    """Attiva/disattiva un job."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScheduledJob).where(ScheduledJob.name == name))
        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job '{name}' non trovato")

        job.is_active = not job.is_active
        await db.commit()
        await db.refresh(job)

        # Aggiorna scheduler
        if scheduler:
            if job.is_active:
                job_def = next((j for j in JOB_REGISTRY if j["name"] == name), None)
                if job_def:
                    trigger = CronTrigger.from_crontab(job.cron_expression, timezone="Europe/Rome")
                    scheduler.add_job(
                        _run_job, trigger=trigger,
                        args=[name, job_def["fn"]],
                        id=name, replace_existing=True,
                    )
            else:
                try:
                    scheduler.remove_job(name)
                except Exception:
                    pass

        return {"name": job.name, "is_active": job.is_active}


async def run_now(name: str) -> dict:
    """Esegue un job immediatamente."""
    job_def = next((j for j in JOB_REGISTRY if j["name"] == name), None)
    if not job_def:
        raise ValueError(f"Job '{name}' non registrato")
    await _run_job(name, job_def["fn"])
    return {"name": name, "executed": True}


async def get_logs(name: str, limit: int = 20) -> list[dict]:
    """Ritorna gli ultimi log di esecuzione di un job."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScheduledJobLog)
            .where(ScheduledJobLog.job_name == name)
            .order_by(ScheduledJobLog.started_at.desc())
            .limit(limit)
        )
        logs = result.scalars().all()

    return [
        {
            "id": str(l.id),
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "finished_at": l.finished_at.isoformat() if l.finished_at else None,
            "duration_ms": l.duration_ms,
            "status": l.status,
            "detail": l.detail,
            "records_affected": l.records_affected,
        }
        for l in logs
    ]
