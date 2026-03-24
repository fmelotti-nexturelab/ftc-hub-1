from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import User
from app.models.tickets import Ticket, TicketStatus
from app.models.ticket_config import (
    TicketTeamModel,
    TicketTeamMemberModel,
    TicketRoutingRuleModel,
)
from app.core.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/admin/diagnostics", tags=["Admin - Diagnostics"])


def _status(count: int, warn_threshold: int = 1, error_threshold: int = 5) -> str:
    if count == 0:
        return "ok"
    if count < error_threshold:
        return "warning"
    return "error"


@router.get(
    "",
    dependencies=[Depends(require_permission("system.admin"))],
)
async def get_diagnostics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checks = []
    now = datetime.now(timezone.utc)

    # 1. Ticket bloccati — aperti/in_progress senza aggiornamenti da 3+ giorni
    stale_threshold = now - timedelta(days=3)
    result = await db.execute(
        select(func.count(Ticket.id)).where(
            cast(Ticket.status, String).in_(["open", "in_progress"]),
            Ticket.is_active == True,
            Ticket.updated_at < stale_threshold,
            Ticket.updated_at.isnot(None),
        )
    )
    stale_count = result.scalar() or 0
    # Include anche quelli mai aggiornati (updated_at is null) creati >3gg fa
    result2 = await db.execute(
        select(func.count(Ticket.id)).where(
            cast(Ticket.status, String).in_(["open", "in_progress"]),
            Ticket.is_active == True,
            Ticket.updated_at.is_(None),
            Ticket.created_at < stale_threshold,
        )
    )
    stale_count += result2.scalar() or 0
    checks.append({
        "name": "Ticket bloccati",
        "description": "Ticket aperti o in lavorazione senza aggiornamenti da più di 3 giorni",
        "status": _status(stale_count, warn_threshold=1, error_threshold=5),
        "count": stale_count,
        "detail": f"{stale_count} ticket fermi da oltre 3 giorni" if stale_count else "Nessun ticket bloccato",
    })

    # 2. Ticket senza team assegnato
    result = await db.execute(
        select(func.count(Ticket.id)).where(
            cast(Ticket.status, String).in_(["open", "in_progress", "waiting"]),
            Ticket.is_active == True,
            Ticket.team_id.is_(None),
        )
    )
    no_team_count = result.scalar() or 0
    checks.append({
        "name": "Ticket senza team",
        "description": "Ticket attivi non assegnati ad alcun team",
        "status": _status(no_team_count, warn_threshold=1, error_threshold=3),
        "count": no_team_count,
        "detail": f"{no_team_count} ticket senza team assegnato" if no_team_count else "Tutti i ticket hanno un team",
    })

    # 3. Membri team con account disattivato
    result = await db.execute(
        select(func.count(TicketTeamMemberModel.id))
        .join(User, User.id == TicketTeamMemberModel.user_id)
        .join(TicketTeamModel, TicketTeamModel.id == TicketTeamMemberModel.team_id)
        .where(
            User.is_active == False,
            TicketTeamModel.is_active == True,
        )
    )
    inactive_members = result.scalar() or 0
    checks.append({
        "name": "Membri team disattivati",
        "description": "Utenti disattivati ancora presenti in team attivi",
        "status": _status(inactive_members, warn_threshold=1, error_threshold=3),
        "count": inactive_members,
        "detail": f"{inactive_members} utenti disattivati presenti in team" if inactive_members else "Nessun membro disattivato nei team",
    })

    # 4. Regole di routing con team disattivato
    result = await db.execute(
        select(func.count(TicketRoutingRuleModel.id))
        .join(TicketTeamModel, TicketTeamModel.id == TicketRoutingRuleModel.team_id, isouter=True)
        .where(
            TicketRoutingRuleModel.is_active == True,
            TicketRoutingRuleModel.team_id.isnot(None),
            TicketTeamModel.is_active == False,
        )
    )
    broken_rules = result.scalar() or 0
    checks.append({
        "name": "Regole routing rotte",
        "description": "Regole di routing attive che puntano a team disattivati",
        "status": _status(broken_rules, warn_threshold=1, error_threshold=2),
        "count": broken_rules,
        "detail": f"{broken_rules} regole di routing con team disattivato" if broken_rules else "Tutte le regole di routing sono valide",
    })

    # 5. Tempi medi presa in carico per team (flag se media > 24h)
    result = await db.execute(
        select(
            TicketTeamModel.name,
            func.avg(
                func.extract("epoch", Ticket.taken_at) - func.extract("epoch", Ticket.created_at)
            ).label("avg_seconds"),
        )
        .join(Ticket, Ticket.team_id == TicketTeamModel.id)
        .where(
            Ticket.taken_at.isnot(None),
            Ticket.created_at.isnot(None),
            TicketTeamModel.is_active == True,
        )
        .group_by(TicketTeamModel.name)
    )
    rows = result.all()
    slow_teams = [(name, avg) for name, avg in rows if avg and avg > 86400]
    sla_status = "error" if len(slow_teams) >= 2 else ("warning" if slow_teams else "ok")
    if slow_teams:
        detail_parts = [f"{name} ({round(avg/3600, 1)}h media)" for name, avg in slow_teams]
        sla_detail = "Team lenti: " + ", ".join(detail_parts)
    else:
        sla_detail = "Tutti i team entro le 24h"
    checks.append({
        "name": "SLA presa in carico",
        "description": "Team con tempo medio di presa in carico superiore a 24 ore",
        "status": sla_status,
        "count": len(slow_teams),
        "detail": sla_detail,
    })

    # Stato globale
    statuses = [c["status"] for c in checks]
    if "error" in statuses:
        global_status = "error"
    elif "warning" in statuses:
        global_status = "warning"
    else:
        global_status = "ok"

    return {
        "status": global_status,
        "checked_at": now.isoformat(),
        "checks": checks,
    }
