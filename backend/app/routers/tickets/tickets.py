import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, func, case, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth import User, UserDepartment
from app.models.tickets import Ticket, TicketAttachment
from app.models.ticket_config import TicketTeamModel, TicketCategoryModel, TicketSubcategoryModel
from app.models.stores import Store
from app.models.rbac_scope import UserAssignment
from app.schemas.tickets import (
    AttachmentResponse,
    CommentCreate,
    CommentResponse,
    TicketAssignUpdate,
    TicketForwardUpdate,
    TicketBulkAction,
    TicketCreate,
    TicketResponse,
    TicketStatusUpdate,
    UserBrief,
    UserListResponse,
)
from app.core.dependencies import get_current_user, require_permission
from app.services.tickets import ticket_service, comment_service

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

# Permessi e tipi file accettati
ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


async def _check_manage(db: AsyncSession, user: User) -> bool:
    """Restituisce True se l'utente ha can_manage sul modulo tickets."""
    from app.core.dependencies import _user_can_access_module
    return await _user_can_access_module(db, user, "tickets", need_manage=True)


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get(
    "/stats",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def ticket_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    def _counts(q):
        s = cast(Ticket.status, String)
        return q.add_columns(
            func.count(Ticket.id).label("total"),
            func.count(case((s == "open",        1))).label("open"),
            func.count(case((s == "in_progress", 1))).label("in_progress"),
            func.count(case((s == "waiting",     1))).label("waiting"),
            func.count(case((s == "resolved",    1))).label("resolved"),
            func.count(case((s == "closed",      1))).label("closed"),
        )

    # Totali globali
    totals_res = await db.execute(
        _counts(select()).select_from(Ticket).where(Ticket.is_active == True)
    )
    row = totals_res.one()
    totals = {"total": row.total, "open": row.open, "in_progress": row.in_progress,
              "waiting": row.waiting, "resolved": row.resolved, "closed": row.closed}

    # Per team
    team_res = await db.execute(
        _counts(
            select(TicketTeamModel.name.label("team_name"))
            .outerjoin(Ticket, (Ticket.team_id == TicketTeamModel.id) & Ticket.is_active)
        ).group_by(TicketTeamModel.name).order_by(func.count().desc())
    )
    by_team = [
        {"name": r.team_name, "total": r.total, "open": r.open,
         "in_progress": r.in_progress, "waiting": r.waiting,
         "resolved": r.resolved, "closed": r.closed}
        for r in team_res.all() if r.total > 0
    ]

    # Per categoria
    cat_res = await db.execute(
        _counts(
            select(TicketCategoryModel.name.label("cat_name"))
            .outerjoin(Ticket, (Ticket.category_id == TicketCategoryModel.id) & Ticket.is_active)
        ).group_by(TicketCategoryModel.name).order_by(func.count().desc())
    )
    by_category = [
        {"name": r.cat_name, "total": r.total, "open": r.open,
         "in_progress": r.in_progress, "waiting": r.waiting,
         "resolved": r.resolved, "closed": r.closed}
        for r in cat_res.all() if r.total > 0
    ]

    # Per sottocategoria
    subcat_res = await db.execute(
        _counts(
            select(
                TicketSubcategoryModel.name.label("subcat_name"),
                TicketCategoryModel.name.label("cat_name"),
            )
            .outerjoin(Ticket, (Ticket.subcategory_id == TicketSubcategoryModel.id) & Ticket.is_active)
            .outerjoin(TicketCategoryModel, TicketSubcategoryModel.category_id == TicketCategoryModel.id)
        ).group_by(TicketSubcategoryModel.name, TicketCategoryModel.name)
         .order_by(func.count().desc())
    )
    by_subcategory = [
        {"name": r.subcat_name, "category": r.cat_name, "total": r.total,
         "open": r.open, "in_progress": r.in_progress, "waiting": r.waiting,
         "resolved": r.resolved, "closed": r.closed}
        for r in subcat_res.all() if r.total > 0
    ]

    # Chiusi per assegnatario (solo SUPERUSER)
    by_assignee = []
    department = getattr(current_user, "department", None)
    from app.models.auth import UserDepartment
    if department == UserDepartment.SUPERUSER:
        assignee_res = await db.execute(
            select(
                User.full_name.label("name"),
                User.username.label("username"),
                func.count().label("closed"),
            )
            .join(Ticket, Ticket.assigned_to == User.id)
            .where(Ticket.is_active == True, cast(Ticket.status, String) == "closed")
            .group_by(User.full_name, User.username)
            .order_by(func.count().desc())
        )
        by_assignee = [
            {"name": r.name or r.username, "closed": r.closed}
            for r in assignee_res.all()
        ]

    return {
        "totals": totals,
        "by_team": by_team,
        "by_category": by_category,
        "by_subcategory": by_subcategory,
        "by_assignee": by_assignee,
    }


# ── Requester defaults ────────────────────────────────────────────────────────

@router.get(
    "/requester-defaults",
    dependencies=[Depends(require_permission("tickets"))],
)
async def requester_defaults(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = current_user.full_name or current_user.username
    email: Optional[str] = None

    if getattr(current_user, "department", None) == UserDepartment.STOREMANAGER:
        # Cerca il negozio tramite user_assignments
        assignment_res = await db.execute(
            select(UserAssignment).where(
                UserAssignment.user_id == current_user.id,
                UserAssignment.is_active.is_(True),
                UserAssignment.store_code.is_not(None),
            )
        )
        assignment = assignment_res.scalars().first()
        if assignment:
            store_res = await db.execute(
                select(Store).where(Store.store_number == assignment.store_code)
            )
            store = store_res.scalar_one_or_none()
            if store:
                email = store.email
    else:
        email = current_user.email

    return {"name": name, "email": email, "phone": current_user.phone or ""}


# ── Ticket CRUD ───────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=TicketResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets"))],
)
async def create_ticket(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ticket_service.create_ticket(db, data, current_user)


@router.get(
    "",
    response_model=List[TicketResponse],
    dependencies=[Depends(require_permission("tickets"))],
)
async def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    created_by_id: Optional[UUID] = Query(None),
    assigned_to_id: Optional[UUID] = Query(None),
    my_team: bool = Query(False),
    include_closed: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_manager = await _check_manage(db, current_user)
    # include_closed solo per STORE/STOREMANAGER (storico view)
    department = getattr(current_user, "department", None)
    allow_closed = include_closed and department in (UserDepartment.STORE, UserDepartment.STOREMANAGER)
    return await ticket_service.get_tickets(
        db, current_user, is_manager,
        status=status, priority=priority, category_id=category_id,
        team_id=team_id, created_by_id=created_by_id, assigned_to_id=assigned_to_id,
        my_team=my_team, include_closed=allow_closed,
    )


@router.get(
    "/users",
    response_model=UserListResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def list_users(db: AsyncSession = Depends(get_db)):
    """Lista utenti per dropdown 'assegna a'."""
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.full_name))
    users = [UserBrief.model_validate(u) for u in result.scalars().all()]
    return UserListResponse(users=users)


@router.put(
    "/bulk",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def bulk_action(
    data: TicketBulkAction,
    db: AsyncSession = Depends(get_db),
):
    return await ticket_service.bulk_action(db, data)


# ── Admin DB management ───────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class _TruncateRequest(_BaseModel):
    password: str

@router.get(
    "/admin/all",
    response_model=List[TicketResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def admin_list_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tutti i ticket (inclusi chiusi) — solo per gestione DB."""
    return await ticket_service.admin_get_all(db)


@router.delete(
    "/admin/truncate",
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def admin_truncate(
    data: _TruncateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Svuota la tabella ticket previa verifica password."""
    if data.password != "admink":
        raise HTTPException(status_code=403, detail="Password non corretta")
    deleted = await ticket_service.admin_truncate_tickets(db)
    return {"deleted": deleted, "message": f"Eliminati {deleted} ticket"}


# ── Storico ticket chiusi ─────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=List[TicketResponse],
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def get_history(
    team_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    assignee_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Storico ticket chiusi — visibilità dipende dal tipo utente."""
    return await ticket_service.get_history(
        db, current_user,
        team_id=team_id, priority=priority,
        category_id=category_id, assignee_id=assignee_id,
    )


# ── Ticket per ID ─────────────────────────────────────────────────────────────

@router.get(
    "/{ticket_id}",
    response_model=TicketResponse,
    dependencies=[Depends(require_permission("tickets"))],
)
async def get_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_manager = await _check_manage(db, current_user)
    return await ticket_service.get_ticket(db, ticket_id, current_user, is_manager)


@router.put(
    "/{ticket_id}/status",
    response_model=TicketResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def update_status(
    ticket_id: UUID,
    data: TicketStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ticket_service.update_status(db, ticket_id, data, current_user)


@router.put(
    "/{ticket_id}/assign",
    response_model=TicketResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def assign_ticket(
    ticket_id: UUID,
    data: TicketAssignUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await ticket_service.assign_ticket(db, ticket_id, data)


# ── Inoltra ticket ────────────────────────────────────────────────────────────

@router.post(
    "/{ticket_id}/forward",
    response_model=TicketResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def forward_ticket(
    ticket_id: UUID,
    data: TicketForwardUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Inoltra il ticket a un team: resetta assegnatario, rimette in OPEN."""
    return await ticket_service.forward_ticket(db, ticket_id, data.team_id)


# ── Prendi in carico ──────────────────────────────────────────────────────────

@router.post(
    "/{ticket_id}/take",
    response_model=TicketResponse,
    dependencies=[Depends(require_permission("tickets", need_manage=True))],
)
async def take_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assegna il ticket all'utente corrente e lo porta in lavorazione."""
    return await ticket_service.take_ticket(db, ticket_id, current_user)


# ── Comments ──────────────────────────────────────────────────────────────────

@router.post(
    "/{ticket_id}/comments",
    response_model=CommentResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets"))],
)
async def add_comment(
    ticket_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_manager = await _check_manage(db, current_user)
    return await comment_service.add_comment(db, ticket_id, data, current_user, is_manager)


@router.get(
    "/{ticket_id}/comments",
    response_model=List[CommentResponse],
    dependencies=[Depends(require_permission("tickets"))],
)
async def get_comments(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_manager = await _check_manage(db, current_user)
    return await comment_service.get_comments(db, ticket_id, current_user, is_manager)


# ── Attachments ───────────────────────────────────────────────────────────────

@router.get(
    "/{ticket_id}/attachments",
    response_model=List[AttachmentResponse],
    dependencies=[Depends(require_permission("tickets"))],
)
async def list_attachments(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_manager = await _check_manage(db, current_user)
    from app.models.tickets import Ticket
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True))
    ticket = t_res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if not is_manager and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")

    result = await db.execute(
        select(TicketAttachment)
        .where(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at)
    )
    return [AttachmentResponse.model_validate(a) for a in result.scalars().all()]


@router.post(
    "/{ticket_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
    dependencies=[Depends(require_permission("tickets"))],
)
async def upload_attachment(
    ticket_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Tipo file non consentito")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 5 MB)")

    # Salva su disco
    dest_dir = Path(settings.TICKET_ATTACHMENTS_PATH) / str(ticket_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = dest_dir / safe_name
    dest_path.write_bytes(content)

    attachment = TicketAttachment(
        ticket_id=ticket_id,
        filename=file.filename,
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return AttachmentResponse.model_validate(attachment)


@router.get(
    "/attachments/{attachment_id}",
    dependencies=[Depends(require_permission("tickets"))],
)
async def download_attachment(
    attachment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TicketAttachment).where(TicketAttachment.id == attachment_id)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Allegato non trovato")

    is_manager = await _check_manage(db, current_user)
    if not is_manager:
        # Verifica che il ticket appartenga all'utente
        from app.models.tickets import Ticket
        t_res = await db.execute(select(Ticket).where(Ticket.id == att.ticket_id))
        ticket = t_res.scalar_one_or_none()
        if not ticket or ticket.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Accesso negato")

    if not os.path.isfile(att.file_path):
        raise HTTPException(status_code=404, detail="File non trovato su disco")

    return FileResponse(att.file_path, filename=att.filename, media_type=att.mime_type)
