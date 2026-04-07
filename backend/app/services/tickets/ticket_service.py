from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, or_, cast, String, case, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User, UserDepartment
from app.models.rbac_scope import UserAssignment
from app.models.tickets import Ticket, TicketStatus, TicketComment, TicketAttachment
from app.models.notification import Notification
from app.models.ticket_config import (
    TicketCategoryModel,
    TicketSubcategoryModel,
    TicketTeamModel,
    TicketTeamMemberModel,
)
from app.schemas.tickets import TicketCreate, TicketResponse, TicketStatusUpdate, TicketAssignUpdate, TicketBulkAction
from app.services.tickets import notification_service, routing_service, chat_service


async def _get_manager_user_ids(db: AsyncSession) -> list:
    """Restituisce gli ID di tutti gli utenti attivi con ruolo di gestione ticket (IT, SUPERUSER)."""
    result = await db.execute(
        select(User.id).where(
            User.is_active == True,
            User.department.in_([UserDepartment.SUPERUSER, UserDepartment.IT]),
        )
    )
    return result.scalars().all()


def _enrich(
    ticket: Ticket,
    creator: Optional[User],
    assignee: Optional[User],
    category_name: Optional[str] = None,
    subcategory_name: Optional[str] = None,
    team_name: Optional[str] = None,
    team_email: Optional[str] = None,
    flags: Optional[dict] = None,
) -> TicketResponse:
    r = TicketResponse.model_validate(ticket)
    r.creator_name = creator.full_name or creator.username if creator else None
    r.assignee_name = assignee.full_name or assignee.username if assignee else None
    r.category_name = category_name
    r.subcategory_name = subcategory_name
    r.team_name = team_name
    if flags:
        r.has_attachments = flags.get("has_attachments", False)
        r.has_comments = flags.get("has_comments", False)
        r.has_internal_notes = flags.get("has_internal_notes", False)
        # has_solution viene già da model_validate (campo DB)
    return r


async def _get_ticket_flags(db: AsyncSession, ticket_ids: list) -> dict:
    """Restituisce {ticket_id: {has_attachments, has_comments, has_internal_notes}} via batch query."""
    if not ticket_ids:
        return {}

    att_res = await db.execute(
        select(TicketAttachment.ticket_id)
        .where(TicketAttachment.ticket_id.in_(ticket_ids))
        .distinct()
    )
    att_set = set(att_res.scalars().all())

    pub_res = await db.execute(
        select(TicketComment.ticket_id)
        .where(
            TicketComment.ticket_id.in_(ticket_ids),
            TicketComment.is_active == True,
            TicketComment.is_internal == False,
        )
        .distinct()
    )
    pub_set = set(pub_res.scalars().all())

    int_res = await db.execute(
        select(TicketComment.ticket_id)
        .where(
            TicketComment.ticket_id.in_(ticket_ids),
            TicketComment.is_active == True,
            TicketComment.is_internal == True,
        )
        .distinct()
    )
    int_set = set(int_res.scalars().all())

    return {
        tid: {
            "has_attachments": tid in att_set,
            "has_comments": tid in pub_set,
            "has_internal_notes": tid in int_set,
        }
        for tid in ticket_ids
    }


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
    # ticket_number: usa sequenza PostgreSQL (concurrency-safe)
    result = await db.execute(text("SELECT nextval('tickets.ticket_number_seq')"))
    next_num = result.scalar()

    # Auto-popola store_number per STORE e STOREMANAGER
    store_number: Optional[str] = None
    department = getattr(current_user, "department", None)
    if department in (UserDepartment.STORE, UserDepartment.STOREMANAGER):
        store_number = await _get_user_store_number(db, current_user.id)

    original_description = data.original_description or data.description
    description = await chat_service.enhance_description(data.title, data.description)

    ticket = Ticket(
        ticket_number=next_num,
        title=data.title,
        description=description,
        original_description=original_description,
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

    # Notifiche best-effort
    creator_name = current_user.full_name or current_user.username
    await notification_service.notify_new_ticket(ticket.ticket_number, ticket.title, creator_name)
    if team_email:
        await notification_service.notify_team(
            team_email, ticket.ticket_number, ticket.title, creator_name
        )

    # Notifiche in-app: notifica tutti i manager + l'assegnato (se presente)
    manager_ids = await _get_manager_user_ids(db)
    recipients = list({uid for uid in manager_ids if uid != current_user.id})
    if ticket.assigned_to and ticket.assigned_to not in recipients and ticket.assigned_to != current_user.id:
        recipients.append(ticket.assigned_to)
    await notification_service.push_to_many(
        db, recipients,
        type="ticket_new",
        title=f"Nuovo ticket #{ticket.ticket_number:04d}",
        body=f"{ticket.title} — aperto da {creator_name}",
        ticket_id=ticket.id,
    )
    await db.commit()

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
    my_team: bool = False,
    include_closed: bool = False,
) -> list[TicketResponse]:
    status_order = case(
        (cast(Ticket.status, String) == "open", 0),
        (cast(Ticket.status, String) == "in_progress", 1),
        (cast(Ticket.status, String) == "waiting", 2),
        (cast(Ticket.status, String) == "resolved", 3),
        else_=4,
    )
    priority_order = case(
        (cast(Ticket.priority, String) == "critical", 0),
        (cast(Ticket.priority, String) == "high", 1),
        (cast(Ticket.priority, String) == "medium", 2),
        (cast(Ticket.priority, String) == "low", 3),
        else_=4,
    )

    stmt = select(Ticket).where(Ticket.is_active == True)
    if not include_closed:
        # escludi sia "closed" che "resolved" (trattati ugualmente come stati finali)
        stmt = stmt.where(cast(Ticket.status, String).notin_(["closed", "resolved"]))

    from sqlalchemy import or_
    department = getattr(current_user, "department", None)
    is_privileged = department in (
        UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
    )

    if department == UserDepartment.STOREMANAGER:
        # Vede solo i ticket del suo negozio
        store_number = await _get_user_store_number(db, current_user.id)
        if store_number:
            stmt = stmt.where(Ticket.store_number == store_number)
        else:
            stmt = stmt.where(Ticket.created_by == current_user.id)

    elif is_privileged:
        # IT / ADMIN / SUPERUSER: accesso completo con filtri opzionali
        if my_team:
            team_ids_result = await db.execute(
                select(TicketTeamMemberModel.team_id).where(
                    TicketTeamMemberModel.user_id == current_user.id
                )
            )
            user_team_ids = list(team_ids_result.scalars().all())
            if user_team_ids:
                stmt = stmt.where(
                    or_(Ticket.team_id.in_(user_team_ids), Ticket.assigned_to == current_user.id)
                )
        else:
            if created_by_id:
                stmt = stmt.where(Ticket.created_by == created_by_id)
            if assigned_to_id:
                stmt = stmt.where(Ticket.assigned_to == assigned_to_id)
            if team_id:
                stmt = stmt.where(Ticket.team_id == team_id)

    else:
        # HO non-privilegiato (FACILITIES, HR, ecc.):
        # vede solo i ticket del proprio team, indipendentemente da is_manager
        team_ids_result = await db.execute(
            select(TicketTeamMemberModel.team_id).where(
                TicketTeamMemberModel.user_id == current_user.id
            )
        )
        user_team_ids = list(team_ids_result.scalars().all())

        if not user_team_ids:
            # Fallback: team il cui nome corrisponde al department
            dept_str = getattr(department, "value", str(department)) if department else ""
            team_by_dept_result = await db.execute(
                select(TicketTeamModel.id).where(
                    func.upper(TicketTeamModel.name) == dept_str.upper()
                )
            )
            user_team_ids = list(team_by_dept_result.scalars().all())

        if user_team_ids:
            stmt = stmt.where(
                or_(Ticket.team_id.in_(user_team_ids), Ticket.assigned_to == current_user.id)
            )
        else:
            # Nessun team trovato: solo ticket creati o assegnati all'utente
            stmt = stmt.where(
                or_(Ticket.created_by == current_user.id, Ticket.assigned_to == current_user.id)
            )

    if status:
        # "closed" include anche i vecchi ticket con status "resolved"
        if status == "closed":
            stmt = stmt.where(cast(Ticket.status, String).in_(["closed", "resolved"]))
        else:
            stmt = stmt.where(cast(Ticket.status, String) == status)
    if priority:
        stmt = stmt.where(cast(Ticket.priority, String) == priority)
    if category_id:
        stmt = stmt.where(Ticket.category_id == category_id)

    stmt = stmt.order_by(status_order, priority_order, Ticket.created_at.asc())
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

    # Flag icone lista
    ticket_ids = [t.id for t in tickets]
    flags_map = await _get_ticket_flags(db, ticket_ids)

    return [
        _enrich(
            t,
            users.get(t.created_by),
            users.get(t.assigned_to),
            category_name=cat_map.get(t.category_id) if t.category_id else None,
            subcategory_name=sub_map.get(t.subcategory_id) if t.subcategory_id else None,
            team_name=team_map.get(t.team_id) if t.team_id else None,
            flags=flags_map.get(t.id, {}),
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
        # Controlla se l'utente è membro del team a cui è assegnato il ticket
        allowed = False
        if ticket.team_id:
            member_result = await db.execute(
                select(TicketTeamMemberModel).where(
                    TicketTeamMemberModel.user_id == current_user.id,
                    TicketTeamMemberModel.team_id == ticket.team_id,
                )
            )
            allowed = member_result.scalar_one_or_none() is not None
        if not allowed and ticket.assigned_to == current_user.id:
            allowed = True
        if not allowed:
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

    # Solo IT/ADMIN o l'assegnatario del ticket possono chiuderlo
    if data.status == TicketStatus.CLOSED:
        dept = getattr(current_user, "department", None)
        is_privileged = dept in (UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT)
        is_assignee = ticket.assigned_to == current_user.id
        if not is_privileged and not is_assignee:
            raise HTTPException(status_code=403, detail="Solo l'assegnatario o un amministratore può chiudere il ticket")

    ticket.status = data.status
    if data.status == TicketStatus.CLOSED:
        now = datetime.now(timezone.utc)
        ticket.closed_at = now
        if ticket.taken_at:
            delta = now - ticket.taken_at
            ticket.resolution_minutes = int(delta.total_seconds() // 60)

    await db.commit()
    await db.refresh(ticket)

    # Notifiche all'autore
    creator_result = await db.execute(select(User).where(User.id == ticket.created_by))
    creator = creator_result.scalar_one_or_none()
    if creator:
        if creator.email:
            await notification_service.notify_status_change(
                creator.email, ticket.ticket_number, ticket.title, data.status.value
            )
        status_labels = {
            "open": "Aperto", "in_progress": "In lavorazione",
            "waiting": "In attesa", "resolved": "Risolto", "closed": "Chiuso",
        }
        label = status_labels.get(data.status.value, data.status.value)
        await notification_service.push(
            db, creator.id,
            type="ticket_status",
            title=f"Ticket #{ticket.ticket_number:04d} aggiornato",
            body=f"Stato aggiornato a: {label}",
            ticket_id=ticket.id,
        )
        await db.commit()

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


async def take_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    current_user: User,
) -> TicketResponse:
    """Prendi in carico: assegna il ticket all'utente corrente e segna taken_at."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket già chiuso")

    ticket.assigned_to = current_user.id
    ticket.taken_at = datetime.now(timezone.utc)
    if ticket.status == TicketStatus.OPEN:
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


async def get_history(
    db: AsyncSession,
    current_user: User,
    team_id: Optional[int] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    assignee_id: Optional[UUID] = None,
) -> list[TicketResponse]:
    """
    Storico ticket chiusi.
    - SUPERUSER / IT: tutti i ticket chiusi, filtri opzionali completi
    - Altri manager: solo i ticket assegnati a se stessi
    """
    from app.models.auth import UserDepartment

    stmt = (
        select(Ticket)
        .where(Ticket.is_active == True, cast(Ticket.status, String) == "closed")
        .order_by(Ticket.closed_at.desc())
    )

    department = getattr(current_user, "department", None)
    is_superuser_or_it = department in (UserDepartment.SUPERUSER, UserDepartment.IT)

    if not is_superuser_or_it:
        stmt = stmt.where(Ticket.assigned_to == current_user.id)
    else:
        if team_id:
            stmt = stmt.where(Ticket.team_id == team_id)
        if assignee_id:
            stmt = stmt.where(Ticket.assigned_to == assignee_id)

    if priority:
        stmt = stmt.where(cast(Ticket.priority, String) == priority)
    if category_id:
        stmt = stmt.where(Ticket.category_id == category_id)

    result = await db.execute(stmt)
    tickets = result.scalars().all()

    all_ids = set()
    for t in tickets:
        all_ids.add(t.created_by)
        if t.assigned_to:
            all_ids.add(t.assigned_to)
    users = await _get_users(db, *all_ids) if all_ids else {}

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

async def admin_get_all(db: AsyncSession) -> list[TicketResponse]:
    """Tutti i ticket (inclusi chiusi) ordinati per numero decrescente."""
    stmt = select(Ticket).where(Ticket.is_active == True).order_by(Ticket.ticket_number.desc())
    result = await db.execute(stmt)
    tickets = result.scalars().all()

    all_ids = set()
    for t in tickets:
        all_ids.add(t.created_by)
        if t.assigned_to:
            all_ids.add(t.assigned_to)
    users = await _get_users(db, *all_ids) if all_ids else {}

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


async def admin_truncate_tickets(db: AsyncSession) -> int:
    """Elimina tutti i ticket e i dati collegati. Restituisce il numero di ticket eliminati."""
    count_result = await db.execute(select(func.count()).select_from(Ticket).where(Ticket.is_active == True))
    total = count_result.scalar() or 0

    # Elimina in ordine per rispettare i FK
    await db.execute(delete(TicketAttachment))
    await db.execute(delete(TicketComment))
    await db.execute(delete(Notification).where(Notification.ticket_id != None))
    await db.execute(delete(Ticket))
    await db.commit()

    return total


async def forward_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    team_id: int,
    assigned_to: UUID | None = None,
) -> TicketResponse:
    """Inoltra il ticket a un altro team, opzionalmente assegnandolo a un membro."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Impossibile inoltrare un ticket chiuso")

    ticket.team_id = team_id
    ticket.assigned_to = assigned_to
    if ticket.status == TicketStatus.IN_PROGRESS:
        ticket.status = TicketStatus.OPEN

    await db.commit()
    await db.refresh(ticket)

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
