from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.models.auth import User
from app.models.daily_tasks import DailyTask, DailyTaskLog
from app.schemas.daily_tasks import DailyTaskOut, CompleteRequest, CompleteResponse, HistoryEntry

router = APIRouter(prefix="/api/ho/daily-tasks", tags=["HO - Daily Tasks"])


def _today_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("", response_model=list[DailyTaskOut])
async def get_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailyTask)
        .where(DailyTask.is_active == True)
        .order_by(DailyTask.sort_order, DailyTask.name)
    )
    tasks = result.scalars().all()

    today = _today_start()

    # Recupera ultimo log per ogni task
    last_logs_q = await db.execute(
        select(
            DailyTaskLog.task_id,
            func.max(DailyTaskLog.done_at).label("last_done_at"),
        )
        .group_by(DailyTaskLog.task_id)
    )
    last_logs = {row.task_id: row.last_done_at for row in last_logs_q}

    # Recupera chi ha completato oggi
    today_logs_q = await db.execute(
        select(DailyTaskLog.task_id, DailyTaskLog.done_at, User.username)
        .join(User, DailyTaskLog.done_by == User.id, isouter=True)
        .where(DailyTaskLog.done_at >= today)
        .order_by(DailyTaskLog.done_at.desc())
    )
    today_logs: dict[UUID, tuple] = {}
    for row in today_logs_q:
        if row.task_id not in today_logs:
            today_logs[row.task_id] = (row.done_at, row.username)

    out = []
    for task in tasks:
        last_done_at = last_logs.get(task.id)
        done_today_entry = today_logs.get(task.id)
        out.append(DailyTaskOut(
            id=task.id,
            code=task.code,
            name=task.name,
            instructions=task.instructions,
            frequency=task.frequency,
            sort_order=task.sort_order,
            is_active=task.is_active,
            done_today=done_today_entry is not None,
            last_done_at=done_today_entry[0] if done_today_entry else last_done_at,
            last_done_by=done_today_entry[1] if done_today_entry else None,
        ))
    return out


@router.post("/complete", response_model=CompleteResponse)
async def complete_tasks(
    req: CompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.task_ids:
        raise HTTPException(status_code=422, detail="Nessun task selezionato")

    result = await db.execute(
        select(DailyTask.id).where(
            DailyTask.id.in_(req.task_ids),
            DailyTask.is_active == True,
        )
    )
    valid_ids = {row[0] for row in result}
    if not valid_ids:
        raise HTTPException(status_code=404, detail="Nessun task valido trovato")

    now = datetime.now(timezone.utc)
    for task_id in valid_ids:
        db.add(DailyTaskLog(
            task_id=task_id,
            done_at=now,
            done_by=current_user.id,
            notes=req.notes,
        ))
    await db.commit()

    return CompleteResponse(completed=len(valid_ids), done_at=now)


@router.get("/history", response_model=list[HistoryEntry])
async def get_history(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            DailyTaskLog.task_id,
            DailyTask.name.label("task_name"),
            DailyTaskLog.done_at,
            User.username.label("done_by"),
            DailyTaskLog.notes,
        )
        .join(DailyTask, DailyTaskLog.task_id == DailyTask.id)
        .join(User, DailyTaskLog.done_by == User.id, isouter=True)
        .where(DailyTaskLog.done_at >= since)
        .order_by(DailyTaskLog.done_at.desc())
    )
    return [
        HistoryEntry(
            task_id=row.task_id,
            task_name=row.task_name,
            done_at=row.done_at,
            done_by=row.done_by,
            notes=row.notes,
        )
        for row in result
    ]
