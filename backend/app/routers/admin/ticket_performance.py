from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, cast, String, case, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tickets import Ticket
from app.models.ticket_config import TicketTeamModel, TicketCategoryModel
from app.core.dependencies import require_permission
from app.services.tickets import analyst_service

router = APIRouter(prefix="/api/admin/tickets/performance", tags=["Admin - Ticket Performance"])

SLA_HOURS = {"critical": 4, "high": 24, "medium": 72, "low": 168}


def _now():
    return datetime.now(timezone.utc)


def _s():
    return cast(Ticket.status, String)


def _p():
    return cast(Ticket.priority, String)


@router.get(
    "",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def get_performance(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    now = _now()
    since = now - timedelta(days=days)
    since_prev = since - timedelta(days=days)
    base = Ticket.is_active == True
    s = _s()
    p = _p()
    is_closed = s.in_(["closed", "resolved"])
    is_open   = s.in_(["open", "in_progress", "waiting"])

    # ── Volume corrente vs periodo precedente ──────────────────────────────────
    vol_res = await db.execute(
        select(
            func.count(case((Ticket.created_at >= since, 1))).label("current"),
            func.count(case((and_(Ticket.created_at >= since_prev, Ticket.created_at < since), 1))).label("previous"),
        ).where(base)
    )
    vol = vol_res.one()

    # ── Snapshot ticket aperti ora ─────────────────────────────────────────────
    open_res = await db.execute(
        select(
            func.count(Ticket.id).label("total"),
            func.count(case((p == "critical", 1))).label("critical"),
            func.count(case((p == "high",     1))).label("high"),
            func.count(case((p == "medium",   1))).label("medium"),
            func.count(case((p == "low",      1))).label("low"),
        ).where(base, is_open)
    )
    open_now = open_res.one()

    # ── Ticket non assegnati ───────────────────────────────────────────────────
    unassigned_res = await db.execute(
        select(func.count(Ticket.id)).where(
            base, s.in_(["open", "in_progress"]), Ticket.assigned_to.is_(None)
        )
    )
    unassigned = unassigned_res.scalar() or 0

    # ── Ticket in ritardo ─────────────────────────────────────────────────────
    overdue_filter = or_(
        and_(p == "critical", Ticket.created_at < now - timedelta(hours=SLA_HOURS["critical"])),
        and_(p == "high",     Ticket.created_at < now - timedelta(hours=SLA_HOURS["high"])),
        and_(p == "medium",   Ticket.created_at < now - timedelta(hours=SLA_HOURS["medium"])),
        and_(p == "low",      Ticket.created_at < now - timedelta(hours=SLA_HOURS["low"])),
    )
    overdue_res = await db.execute(
        select(func.count(Ticket.id)).where(base, is_open, overdue_filter)
    )
    overdue = overdue_res.scalar() or 0

    # ── Tempi medi per priorità ────────────────────────────────────────────────
    times_res = await db.execute(
        select(
            p.label("priority"),
            func.avg(
                func.extract("epoch", Ticket.taken_at - Ticket.created_at) / 60
            ).label("avg_response_min"),
            func.avg(
                func.extract("epoch", Ticket.closed_at - Ticket.taken_at) / 60
            ).label("avg_resolution_min"),
            func.avg(
                func.extract("epoch", Ticket.closed_at - Ticket.created_at) / 60
            ).label("avg_total_min"),
            func.count(Ticket.id).label("count"),
        ).where(
            base, is_closed,
            Ticket.closed_at >= since,
            Ticket.taken_at.is_not(None),
            Ticket.closed_at.is_not(None),
        ).group_by(p)
    )
    times_by_priority = {}
    for row in times_res.all():
        times_by_priority[row.priority] = {
            "avg_response_min": round(row.avg_response_min or 0),
            "avg_resolution_min": round(row.avg_resolution_min or 0),
            "avg_total_min": round(row.avg_total_min or 0),
            "count": row.count,
        }

    # ── SLA compliance ─────────────────────────────────────────────────────────
    sla_data = {}
    for prio, hours in SLA_HOURS.items():
        threshold_secs = hours * 3600
        res = await db.execute(
            select(
                func.count(Ticket.id).label("total"),
                func.count(case((
                    func.extract("epoch", Ticket.closed_at - Ticket.created_at) <= threshold_secs, 1
                ))).label("within_sla"),
            ).where(base, p == prio, is_closed, Ticket.closed_at >= since, Ticket.closed_at.is_not(None))
        )
        row = res.one()
        pct = round(row.within_sla / row.total * 100) if row.total > 0 else None
        sla_data[prio] = {"total": row.total, "within_sla": row.within_sla, "pct": pct}

    # ── Per team ──────────────────────────────────────────────────────────────
    team_res = await db.execute(
        select(
            TicketTeamModel.name.label("team"),
            func.count(case((s == "open",        1))).label("open"),
            func.count(case((s == "in_progress", 1))).label("in_progress"),
            func.count(case((s == "waiting",     1))).label("waiting"),
            func.count(case((is_closed,          1))).label("closed"),
            func.count(case((and_(is_closed, Ticket.closed_at >= since), 1))).label("closed_period"),
            func.avg(case((
                and_(is_closed, Ticket.closed_at >= since,
                     Ticket.closed_at.is_not(None), Ticket.taken_at.is_not(None)),
                func.extract("epoch", Ticket.closed_at - Ticket.taken_at) / 60
            ))).label("avg_res_min"),
        )
        .outerjoin(Ticket, and_(Ticket.team_id == TicketTeamModel.id, base))
        .group_by(TicketTeamModel.name)
        .order_by(func.count(Ticket.id).desc())
    )
    by_team = []
    for r in team_res.all():
        total = r.open + r.in_progress + r.waiting + r.closed
        if total > 0:
            by_team.append({
                "team": r.team,
                "open": r.open,
                "in_progress": r.in_progress,
                "waiting": r.waiting,
                "closed": r.closed,
                "closed_period": r.closed_period,
                "avg_res_min": round(r.avg_res_min) if r.avg_res_min else None,
            })

    # ── Top categorie ─────────────────────────────────────────────────────────
    cat_res = await db.execute(
        select(
            TicketCategoryModel.name.label("category"),
            func.count(Ticket.id).label("count"),
        )
        .join(Ticket, and_(Ticket.category_id == TicketCategoryModel.id, base, Ticket.created_at >= since))
        .group_by(TicketCategoryModel.name)
        .order_by(func.count(Ticket.id).desc())
        .limit(8)
    )
    top_categories = [{"category": r.category, "count": r.count} for r in cat_res.all()]

    # ── Top negozi ────────────────────────────────────────────────────────────
    store_res = await db.execute(
        select(
            Ticket.store_number.label("store"),
            func.count(Ticket.id).label("count"),
        ).where(base, Ticket.created_at >= since, Ticket.store_number.is_not(None))
        .group_by(Ticket.store_number)
        .order_by(func.count(Ticket.id).desc())
        .limit(10)
    )
    top_stores = [{"store": r.store, "count": r.count} for r in store_res.all()]

    # ── Trend giornaliero ─────────────────────────────────────────────────────
    trend_days = min(days, 60)
    trend_since = now - timedelta(days=trend_days)
    day_expr = func.date_trunc("day", Ticket.created_at)
    trend_res = await db.execute(
        select(
            day_expr.label("day"),
            func.count(Ticket.id).label("opened"),
            func.count(case((is_closed, 1))).label("closed"),
        )
        .where(base, Ticket.created_at >= trend_since)
        .group_by(day_expr)
        .order_by(day_expr)
    )
    trend = [
        {"day": r.day.strftime("%Y-%m-%d"), "opened": r.opened, "closed": r.closed}
        for r in trend_res.all()
    ]

    return {
        "period_days": days,
        "volume": {
            "current": vol.current,
            "previous": vol.previous,
            "delta_pct": round((vol.current - vol.previous) / vol.previous * 100)
                         if vol.previous > 0 else None,
        },
        "open_now": {
            "total": open_now.total,
            "critical": open_now.critical,
            "high": open_now.high,
            "medium": open_now.medium,
            "low": open_now.low,
            "unassigned": unassigned,
            "overdue": overdue,
        },
        "times_by_priority": times_by_priority,
        "sla": sla_data,
        "by_team": by_team,
        "top_categories": top_categories,
        "top_stores": top_stores,
        "trend": trend,
        "sla_thresholds": SLA_HOURS,
    }


class AnalystQuestion(BaseModel):
    question: str
    off_topic_count: int = 0


@router.post(
    "/analyst",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def ask_analyst(data: AnalystQuestion):
    """Analisi AI sui dati ticket tramite query SQL read-only."""
    return await analyst_service.ask(data.question, data.off_topic_count)
