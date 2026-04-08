from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import User
from app.models.ticket_config import (
    TicketCategoryModel,
    TicketSubcategoryModel,
    TicketTeamModel,
    TicketTeamMemberModel,
    TicketRoutingRuleModel,
)
from app.schemas.ticket_config import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    SubcategoryCreate,
    SubcategoryResponse,
    SubcategoryUpdate,
    TeamCreate,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamResponse,
    TeamUpdate,
    RoutingRuleCreate,
    RoutingRuleResponse,
    RoutingRuleUpdate,
)
from app.core.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/admin/tickets", tags=["Admin - Tickets Config"])


async def _check_admin(db: AsyncSession, user: User) -> bool:
    """Restituisce True se l'utente ha tickets.admin o system.admin."""
    from app.core.dependencies import _resolve_all_permissions, _has_admin_bypass, _has_explicit_allow
    resolved = await _resolve_all_permissions(db=db, user=user)
    if _has_admin_bypass(resolved):
        return True
    return _has_explicit_allow(resolved, "tickets.admin", None, None)


# ── Categories ─────────────────────────────────────────────────────────────────

@router.get(
    "/categories",
    response_model=List[CategoryResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def admin_list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TicketCategoryModel).order_by(TicketCategoryModel.sort_order, TicketCategoryModel.name)
    )
    categories = result.scalars().all()

    sub_counts_res = await db.execute(
        select(
            TicketSubcategoryModel.category_id,
            func.count(TicketSubcategoryModel.id).label("cnt"),
        )
        .where(TicketSubcategoryModel.is_active == True)
        .group_by(TicketSubcategoryModel.category_id)
    )
    sub_counts = {row.category_id: row.cnt for row in sub_counts_res.all()}

    responses = []
    for cat in categories:
        r = CategoryResponse.model_validate(cat)
        r.subcategory_count = sub_counts.get(cat.id, 0)
        responses.append(r)
    return responses


@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    cat = TicketCategoryModel(
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    r = CategoryResponse.model_validate(cat)
    r.subcategory_count = 0
    return r


@router.put(
    "/categories/{category_id}",
    response_model=CategoryResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketCategoryModel).where(TicketCategoryModel.id == category_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)

    sub_count_res = await db.execute(
        select(func.count(TicketSubcategoryModel.id)).where(
            TicketSubcategoryModel.category_id == category_id,
            TicketSubcategoryModel.is_active == True,
        )
    )
    sub_count = sub_count_res.scalar() or 0

    r = CategoryResponse.model_validate(cat)
    r.subcategory_count = sub_count
    return r


@router.delete(
    "/categories/{category_id}",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketCategoryModel).where(TicketCategoryModel.id == category_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    cat.is_active = False
    await db.commit()
    return {"message": "Categoria disattivata"}


# ── Subcategories ──────────────────────────────────────────────────────────────

@router.get(
    "/subcategories",
    response_model=List[SubcategoryResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def admin_list_subcategories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TicketSubcategoryModel).order_by(
            TicketSubcategoryModel.category_id,
            TicketSubcategoryModel.sort_order,
            TicketSubcategoryModel.name,
        )
    )
    return [SubcategoryResponse.model_validate(s) for s in result.scalars().all()]


@router.post(
    "/subcategories",
    response_model=SubcategoryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def create_subcategory(
    data: SubcategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    sub = TicketSubcategoryModel(
        category_id=data.category_id,
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return SubcategoryResponse.model_validate(sub)


@router.put(
    "/subcategories/{subcategory_id}",
    response_model=SubcategoryResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_subcategory(
    subcategory_id: int,
    data: SubcategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketSubcategoryModel).where(TicketSubcategoryModel.id == subcategory_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Sottocategoria non trovata")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)

    await db.commit()
    await db.refresh(sub)
    return SubcategoryResponse.model_validate(sub)


@router.delete(
    "/subcategories/{subcategory_id}",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def delete_subcategory(
    subcategory_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketSubcategoryModel).where(TicketSubcategoryModel.id == subcategory_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Sottocategoria non trovata")
    sub.is_active = False
    await db.commit()
    return {"message": "Sottocategoria disattivata"}


# ── Teams ──────────────────────────────────────────────────────────────────────

@router.get(
    "/teams",
    response_model=List[TeamResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def list_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TicketTeamModel).order_by(TicketTeamModel.name)
    )
    return [TeamResponse.model_validate(t) for t in result.scalars().all()]


@router.post(
    "/teams",
    response_model=TeamResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
):
    team = TicketTeamModel(
        name=data.name,
        email=data.email,
        description=data.description,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return TeamResponse.model_validate(team)


@router.put(
    "/teams/{team_id}",
    response_model=TeamResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_team(
    team_id: int,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TicketTeamModel).where(TicketTeamModel.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team non trovato")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)
    return TeamResponse.model_validate(team)


@router.delete(
    "/teams/{team_id}",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TicketTeamModel).where(TicketTeamModel.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team non trovato")
    team.is_active = False
    await db.commit()
    return {"message": "Team disattivato"}


# ── Team Members ───────────────────────────────────────────────────────────────

@router.get(
    "/teams/{team_id}/members",
    response_model=List[TeamMemberResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def list_team_members(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    from app.models.auth import User
    result = await db.execute(
        select(TicketTeamMemberModel).where(TicketTeamMemberModel.team_id == team_id)
    )
    members = result.scalars().all()

    user_ids = [m.user_id for m in members]
    users_map: dict = {}
    if user_ids:
        users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_res.scalars().all()}

    responses = []
    for m in members:
        r = TeamMemberResponse.model_validate(m)
        u = users_map.get(m.user_id)
        if u:
            r.username = u.username
            r.full_name = u.full_name
        responses.append(r)
    return responses


@router.post(
    "/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def add_team_member(
    team_id: int,
    data: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verifica che il team esista
    team_res = await db.execute(select(TicketTeamModel).where(TicketTeamModel.id == team_id))
    if not team_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Team non trovato")

    member = TicketTeamMemberModel(
        team_id=team_id,
        user_id=data.user_id,
        is_team_lead=data.is_team_lead,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    from app.models.auth import User
    user_res = await db.execute(select(User).where(User.id == data.user_id))
    user = user_res.scalar_one_or_none()

    r = TeamMemberResponse.model_validate(member)
    if user:
        r.username = user.username
        r.full_name = user.full_name
    return r


@router.delete(
    "/teams/{team_id}/members/{user_id}",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def remove_team_member(
    team_id: int,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketTeamMemberModel).where(
            TicketTeamMemberModel.team_id == team_id,
            TicketTeamMemberModel.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato")
    await db.delete(member)
    await db.commit()
    return {"message": "Membro rimosso"}


@router.put(
    "/teams/{team_id}/members/{user_id}",
    response_model=TeamMemberResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_team_member(
    team_id: int,
    user_id: UUID,
    data: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketTeamMemberModel).where(
            TicketTeamMemberModel.team_id == team_id,
            TicketTeamMemberModel.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)

    from app.models.auth import User
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()

    r = TeamMemberResponse.model_validate(member)
    if user:
        r.username = user.username
        r.full_name = user.full_name
    return r


# ── Routing Rules ──────────────────────────────────────────────────────────────

@router.get(
    "/routing-rules",
    response_model=List[RoutingRuleResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def list_routing_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TicketRoutingRuleModel).order_by(
            TicketRoutingRuleModel.category_id,
            TicketRoutingRuleModel.subcategory_id,
        )
    )
    rules = result.scalars().all()

    # Carica nomi
    cat_ids = list({r.category_id for r in rules})
    sub_ids = list({r.subcategory_id for r in rules if r.subcategory_id})
    t_ids = list({r.team_id for r in rules if r.team_id})

    cat_map: dict = {}
    sub_map: dict = {}
    team_map: dict = {}
    user_map: dict = {}

    if cat_ids:
        res = await db.execute(
            select(TicketCategoryModel).where(TicketCategoryModel.id.in_(cat_ids))
        )
        cat_map = {c.id: c.name for c in res.scalars().all()}

    if sub_ids:
        res = await db.execute(
            select(TicketSubcategoryModel).where(TicketSubcategoryModel.id.in_(sub_ids))
        )
        sub_map = {s.id: s.name for s in res.scalars().all()}

    if t_ids:
        res = await db.execute(
            select(TicketTeamModel).where(TicketTeamModel.id.in_(t_ids))
        )
        team_map = {t.id: t.name for t in res.scalars().all()}

    # Raccoglie tutti gli user ID rilevanti
    user_ids = set()
    for rule in rules:
        for uid in (rule.assigned_user_id, rule.backup_user_id_1, rule.backup_user_id_2):
            if uid:
                user_ids.add(uid)
    if user_ids:
        res = await db.execute(select(User).where(User.id.in_(list(user_ids))))
        user_map = {u.id: (u.full_name or u.username) for u in res.scalars().all()}

    responses = []
    for rule in rules:
        r = RoutingRuleResponse.model_validate(rule)
        r.category_name = cat_map.get(rule.category_id)
        r.subcategory_name = sub_map.get(rule.subcategory_id) if rule.subcategory_id else None
        r.team_name = team_map.get(rule.team_id) if rule.team_id else None
        r.assigned_user_name = user_map.get(rule.assigned_user_id) if rule.assigned_user_id else None
        r.backup_user_name_1 = user_map.get(rule.backup_user_id_1) if rule.backup_user_id_1 else None
        r.backup_user_name_2 = user_map.get(rule.backup_user_id_2) if rule.backup_user_id_2 else None
        responses.append(r)
    return responses


@router.post(
    "/routing-rules",
    response_model=RoutingRuleResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def create_routing_rule(
    data: RoutingRuleCreate,
    db: AsyncSession = Depends(get_db),
):
    rule = TicketRoutingRuleModel(
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        team_id=data.team_id,
        assigned_user_id=data.assigned_user_id,
        backup_user_id_1=data.backup_user_id_1,
        backup_user_id_2=data.backup_user_id_2,
        priority_override=data.priority_override,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    # Enrich names
    cat_name = sub_name = team_name = None
    if rule.category_id:
        res = await db.execute(
            select(TicketCategoryModel).where(TicketCategoryModel.id == rule.category_id)
        )
        c = res.scalar_one_or_none()
        if c:
            cat_name = c.name
    if rule.subcategory_id:
        res = await db.execute(
            select(TicketSubcategoryModel).where(TicketSubcategoryModel.id == rule.subcategory_id)
        )
        s = res.scalar_one_or_none()
        if s:
            sub_name = s.name
    if rule.team_id:
        res = await db.execute(
            select(TicketTeamModel).where(TicketTeamModel.id == rule.team_id)
        )
        t = res.scalar_one_or_none()
        if t:
            team_name = t.name

    r = RoutingRuleResponse.model_validate(rule)
    r.category_name = cat_name
    r.subcategory_name = sub_name
    r.team_name = team_name
    return r


@router.put(
    "/routing-rules/{rule_id}",
    response_model=RoutingRuleResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_routing_rule(
    rule_id: int,
    data: RoutingRuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketRoutingRuleModel).where(TicketRoutingRuleModel.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regola non trovata")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    r = RoutingRuleResponse.model_validate(rule)
    return r


@router.delete(
    "/routing-rules/{rule_id}",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def delete_routing_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketRoutingRuleModel).where(TicketRoutingRuleModel.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regola non trovata")
    await db.delete(rule)
    await db.commit()
    return {"message": "Regola eliminata"}


# ── Training AI ──────────────────────────────────────────────────────────────

@router.get(
    "/training/tickets",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def get_training_tickets(
    limit: int = 300,
    db: AsyncSession = Depends(get_db),
):
    """Estrae un campione di ticket bilanciato per categoria per il training AI."""
    from app.models.tickets import Ticket
    from sqlalchemy import text, cast, String

    result = await db.execute(text("""
        WITH ranked AS (
            SELECT
                t.id, t.ticket_number, t.title,
                LEFT(t.description, 500) as description,
                t.category_id, c.name as category_name,
                t.subcategory_id, s.name as subcategory_name,
                t.team_id, tm.name as team_name,
                CAST(t.priority AS TEXT) as priority,
                ROW_NUMBER() OVER (PARTITION BY t.category_id ORDER BY RANDOM()) as rn
            FROM tickets.tickets t
            LEFT JOIN tickets.ticket_categories c ON c.id = t.category_id
            LEFT JOIN tickets.ticket_subcategories s ON s.id = t.subcategory_id
            LEFT JOIN tickets.ticket_teams tm ON tm.id = t.team_id
            WHERE t.is_active = true AND t.category_id IS NOT NULL
        )
        SELECT id, ticket_number, title, description,
               category_id, category_name, subcategory_id, subcategory_name,
               team_id, team_name, priority
        FROM ranked WHERE rn <= 40
        LIMIT :limit
    """), {"limit": limit})

    return [
        {
            "id": str(r[0]),
            "ticket_number": r[1],
            "title": r[2],
            "description": r[3] or "",
            "category_id": r[4],
            "category_name": r[5],
            "subcategory_id": r[6],
            "subcategory_name": r[7],
            "team_id": r[8],
            "team_name": r[9],
            "priority": r[10],
        }
        for r in result.fetchall()
    ]


from pydantic import BaseModel


class TrainingItem(BaseModel):
    title: str
    description: str
    category_name: str | None
    subcategory_name: str | None
    team_name: str | None
    priority: str


class TrainingSaveRequest(BaseModel):
    examples: list[TrainingItem]


@router.post(
    "/training/save",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def save_training(data: TrainingSaveRequest):
    """Salva gli esempi di training revisionati nel file usato dall'AI."""
    from pathlib import Path

    lines = []
    for ex in data.examples:
        sub = ex.subcategory_name or "—"
        team = ex.team_name or "—"
        lines.append(f"Titolo: {ex.title} | Categoria: {ex.category_name} | Sottocategoria: {sub} | Team: {team} | Priorità: {ex.priority}")

    training_file = Path(__file__).resolve().parent.parent.parent / "app" / "services" / "tickets" / "training_examples.txt"
    training_file.write_text("\n".join(lines), encoding="utf-8")

    return {"saved": len(lines), "message": f"{len(lines)} esempi salvati. L'AI li userà immediatamente."}
