from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User, UserType
from app.models.rbac_scope import UserAssignment
from app.models.tickets import Ticket, TicketStatus
from app.models.ticket_config import (
    TicketCategoryModel,
    TicketSubcategoryModel,
    TicketTeamModel,
)
from app.schemas.tickets import TicketCreate, TicketResponse, TicketStatusUpdate, TicketAssignUpdate, TicketBulkAction
from app.services.tickets import notification_service, routing_service, chat_service


def _enrich(
    ticket: Ticket,
    creator: Optional[User],
    assignee: Optional[User],
    category_name: Optional[str] = None,
    subcategory_name: Optional[str] = None,
    team_name: Optional[str] = None,
    team_email: Optional[str] = None,
) -> TicketResponse:
    r = TicketResponse.model_validate(ticket)
    r.creator_name = creator.full_name or creator.username if creator else None
    r.assignee_name = assignee.full_name or assignee.username if assignee else None
    r.category_name = category_name
    r.subcategory_name = subcategory_name
    r.team_name = team_name
    return r


async def _get_users(db: AsyncSession, *uuids) -> dict:
    """Carica un dizionario {uuid: User} dai uuid non-None."""
    ids = [u for u in uuids if u is not None]
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return {u.id: u for u in result.scalars().all()}


async def _load_name_maps(
    db: AsyncSession,
    category_ids: list[int],
    subcategory_ids: list[int],
    team_ids: list[int],
) -> tuple[dict, dict, dict]:
    """Carica mappe {id: name} per categorie, sottocategorie e team."""
    cat_map: dict[int, str] = {}
    sub_map: dict[int, str] = {}
    team_map: dict[int, str] = {}
    team_email_map: dict[int, str] = {}

    if category_ids:
        res = await db.execute(
            select(TicketCategoryModel).where(TicketCategoryModel.id.in_(category_ids))
        )
        for c in res.scalars().all():
            cat_map[c.id] = c.name

    if subcategory_ids:
        res = await db.execute(
            select(TicketSubcategoryModel).where(TicketSubcategoryModel.id.in_(subcategory_ids))
        )
        for s in res.scalars().all():
            sub_map[s.id] = s.name

    if team_ids:
        res = await db.execute(
            select(TicketTeamModel).where(TicketTeamModel.id.in_(team_ids))
        )
        for t in res.scalars().all():
            team_map[t.id] = t.name
            if t.email:
                team_email_map[t.id] = t.email

    return cat_map, sub_map, team_map, team_email_map


async def _get_user_store_number(db: AsyncSession, user_id) -> Optional[str]:
    """Restituisce lo store_code primario dell'utente da user_assignments, se esiste."""
    result = await db.execute(
        select(UserAssignment).where(
            UserAssignment.user_id == user_id,
            UserAssignment.is_active.is_(True),
            UserAssignment.store_code.is_not(None),
        ).order_by(UserAssignment.assignment_type)  # PRIMARY prima
    )
    assignment = result.scalars().first()
    return assignment.store_code if assignment else None


async def create_ticket(
    db: AsyncSession,
    data: TicketCreate,
    current_user: User,
) -> TicketResponse:
    # ticket_number: prossimo intero disponibile
    result = await db.execute(
        select(func.coalesce(func.max(Ticket.ticket_number), 0))
    )
    next_num = result.scalar() + 1

    # Auto-popola store_number per STORE e STOREMANAGER
    store_number: Optional[str] = None
    user_type = getattr(current_user, "user_type", None)
    if user_type in (UserType.STORE, UserType.STOREMANAGER):
        store_number = await _get_user_store_number(db, current_user.id)

    description = await chat_service.enhance_description(data.title, data.description)

    ticket = Ticket(
        ticket_number=next_num,
        title=data.title,
        description=description,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        priority=data.priority,
        status=TicketStatus.OPEN,
        store_number=store_number,
        requester_name=data.requester_name,
        requester_email=data.requester_email,
        requester_phone=data.requester_phone,
        teamviewer_code=data.teamviewer_code,
        team_id=data.team_id,
        created_by=current_user.id,
    )
    db.add(ticket)
    await db.flush()  # ottieni l'id prima del commit per il routing

    # Routing automatico
    rule = await routing_service.find_rule(db, data.category_id, data.subcategory_id)
    team_email: Optional[str] = None
    if rule:
        if rule.assigned_user_id:
            ticket.assigned_to = rule.assigned_user_id
            ticket.status = TicketStatus.IN_PROGRESS
        if rule.team_id:
            ticket.team_id = rule.team_id
            # carica email del team
            team_res = await db.execute(
                select(TicketTeamModel).where(TicketTeamModel.id == rule.team_id)
            )
            team = team_res.scalar_one_or_none()
            if team:
                team_email = team.email
        if rule.priority_override:
            ticket.priority = rule.priority_override.lower()

    await db.commit()
    await db.refresh(ticket)

    # Notifica best-effort
    creator_name = current_user.full_name or current_user.username
    await notification_service.notify_new_ticket(ticket.ticket_number, ticket.title, creator_name)
    if team_email:
        await notification_service.notify_team(
            team_email, ticket.ticket_number, ticket.title, creator_name
        )

    # Carica nomi per la risposta
    cat_map, sub_map, team_map, _ = await _load_name_maps(
        db,
        [ticket.category_id] if ticket.category_id else [],
        [ticket.subcategory_id] if ticket.subcategory_id else [],
        [ticket.team_id] if ticket.team_id else [],
    )

    users = await _get_users(db, ticket.created_by)
    return _enrich(
        ticket,
        users.get(ticket.created_by),
        None,
        category_name=cat_map.get(ticket.category_id) if ticket.category_id else None,
        subcategory_name=sub_map.get(ticket.subcategory_id) if ticket.subcategory_id else None,
        team_name=team_map.get(ticket.team_id) if ticket.team_id else None,
    )


async def get_tickets(
    db: AsyncSession,
    current_user: User,
    is_manager: bool,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    team_id: Optional[int] = None,
    created_by_id: Optional[UUID] = None,
    assigned_to_id: Optional[UUID] = None,
) -> list[TicketResponse]:
    stmt = select(Ticket).where(Ticket.is_active == True)

    user_type = getattr(current_user, "user_type", None)
    if user_type == UserType.STOREMANAGER:
        # Vede solo i ticket del suo negozio
        store_number = await _get_user_store_number(db, current_user.id)
        if store_number:
            stmt = stmt.where(Ticket.store_number == store_number)
        else:
            stmt = stmt.where(Ticket.created_by == current_user.id)
    elif not is_manager:
        stmt = stmt.where(Ticket.created_by == current_user.id)
    else:
        if created_by_id:
            stmt = stmt.where(Ticket.created_by == created_by_id)
        if assigned_to_id:
            stmt = stmt.where(Ticket.assigned_to == assigned_to_id)
        if team_id:
            stmt = stmt.where(Ticket.team_id == team_id)

    if status:
        stmt = stmt.where(Ticket.status == status)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)
    if category_id:
        stmt = stmt.where(Ticket.category_id == category_id)

    stmt = stmt.order_by(Ticket.created_at.desc())
    result = await db.execute(stmt)
    tickets = result.scalars().all()

    # Carica utenti in batch
    all_ids = set()
    for t in tickets:
        all_ids.add(t.created_by)
        if t.assigned_to:
            all_ids.add(t.assigned_to)
    users = await _get_users(db, *all_ids) if all_ids else {}

    # Carica nomi per la risposta
    cat_ids = list({t.category_id for t in tickets if t.category_id})
    sub_ids = list({t.subcategory_id for t in tickets if t.subcategory_id})
    t_ids = list({t.team_id for t in tickets if t.team_id})
    cat_map, sub_map, team_map, _ = await _load_name_maps(db, cat_ids, sub_ids, t_ids)

    return [
        _enrich(
            t,
            users.get(t.created_by),
            users.get(t.assigned_to),
            category_name=cat_map.get(t.category_id) if t.category_id else None,
            subcategory_name=sub_map.get(t.subcategory_id) if t.subcategory_id else None,
            team_name=team_map.get(t.team_id) if t.team_id else None,
        )
        for t in tickets
    ]


async def get_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    current_user: User,
    is_manager: bool,
) -> TicketResponse:
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if not is_manager and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")

    cat_map, sub_map, team_map, _ = await _load_name_maps(
        db,
        [ticket.category_id] if ticket.category_id else [],
        [ticket.subcategory_id] if ticket.subcategory_id else [],
        [ticket.team_id] if ticket.team_id else [],
    )

    users = await _get_users(db, ticket.created_by, ticket.assigned_to)
    return _enrich(
        ticket,
        users.get(ticket.created_by),
        users.get(ticket.assigned_to),
        category_name=cat_map.get(ticket.category_id) if ticket.category_id else None,
        subcategory_name=sub_map.get(ticket.subcategory_id) if ticket.subcategory_id else None,
        team_name=team_map.get(ticket.team_id) if ticket.team_id else None,
    )


async def update_status(
    db: AsyncSession,
    ticket_id: UUID,
    data: TicketStatusUpdate,
    current_user: User,
) -> TicketResponse:
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    ticket.status = data.status
    if data.status == TicketStatus.CLOSED:
        ticket.closed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ticket)

    # Notifica all'autore
    creator_result = await db.execute(select(User).where(User.id == ticket.created_by))
    creator = creator_result.scalar_one_or_none()
    if creator and creator.email:
        await notification_service.notify_status_change(
            creator.email, ticket.ticket_number, ticket.title, data.status.value
        )

    cat_map, sub_map, team_map, _ = await _load_name_maps(
        db,
        [ticket.category_id] if ticket.category_id else [],
        [ticket.subcategory_id] if ticket.subcategory_id else [],
        [ticket.team_id] if ticket.team_id else [],
    )

    users = await _get_users(db, ticket.created_by, ticket.assigned_to)
    return _enrich(
        ticket,
        users.get(ticket.created_by),
        users.get(ticket.assigned_to),
        category_name=cat_map.get(ticket.category_id) if ticket.category_id else None,
        subcategory_name=sub_map.get(ticket.subcategory_id) if ticket.subcategory_id else None,
        team_name=team_map.get(ticket.team_id) if ticket.team_id else None,
    )


async def bulk_action(
    db: AsyncSession,
    data: TicketBulkAction,
) -> dict:
    if not data.ticket_ids:
        return {"updated": 0}

    result = await db.execute(
        select(Ticket).where(
            Ticket.id.in_(data.ticket_ids),
            Ticket.is_active == True,
        )
    )
    tickets = result.scalars().all()

    now = datetime.now(timezone.utc)
    for ticket in tickets:
        if data.action == "close":
            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = now
        elif data.action == "status" and data.status:
            ticket.status = data.status
            if data.status == TicketStatus.CLOSED:
                ticket.closed_at = now
        elif data.action == "assign":
            ticket.assigned_to = data.assigned_to
            if data.assigned_to and ticket.status == TicketStatus.OPEN:
                ticket.status = TicketStatus.IN_PROGRESS

    await db.commit()
    return {"updated": len(tickets)}


async def assign_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    data: TicketAssignUpdate,
) -> TicketResponse:
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    ticket.assigned_to = data.assigned_to
    if data.assigned_to and ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS

    await db.commit()
    await db.refresh(ticket)

    cat_map, sub_map, team_map, _ = await _load_name_maps(
        db,
        [ticket.category_id] if ticket.category_id else [],
        [ticket.subcategory_id] if ticket.subcategory_id else [],
        [ticket.team_id] if ticket.team_id else [],
    )

    users = await _get_users(db, ticket.created_by, ticket.assigned_to)
    return _enrich(
        ticket,
        users.get(ticket.created_by),
        users.get(ticket.assigned_to),
        category_name=cat_map.get(ticket.category_id) if ticket.category_id else None,
        subcategory_name=sub_map.get(ticket.subcategory_id) if ticket.subcategory_id else None,
        team_name=team_map.get(ticket.team_id) if ticket.team_id else None,
    )
