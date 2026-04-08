from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.ticket_config import TicketTeamMemberModel
from app.models.tickets import Ticket, TicketComment, TicketStatus
from app.schemas.tickets import CommentCreate, CommentResponse
from app.services.tickets import notification_service


def _enrich_comment(comment: TicketComment, author: User | None) -> CommentResponse:
    r = CommentResponse.model_validate(comment)
    r.author_name = author.full_name or author.username if author else None
    return r


async def add_comment(
    db: AsyncSession,
    ticket_id: UUID,
    data: CommentCreate,
    current_user: User,
    is_manager: bool,
) -> CommentResponse:
    # Verifica ticket esiste e l'utente può accedervi
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if not is_manager and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")

    # Solo i manager possono fare note interne o marcare come soluzione
    is_internal = data.is_internal and is_manager
    if data.is_solution and is_manager:
        ticket.has_solution = True

    comment = TicketComment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        content=data.content,
        is_internal=is_internal,
    )
    db.add(comment)

    # Se l'autore del ticket commenta su un ticket chiuso → torna open
    if not is_manager and ticket.created_by == current_user.id and ticket.status == TicketStatus.CLOSED:
        ticket.status = TicketStatus.OPEN

    await db.commit()
    await db.refresh(comment)

    # Notifiche best-effort
    author_name = current_user.full_name or current_user.username
    if not is_internal:
        if is_manager:
            # Manager ha commentato pubblicamente → stato diventa WAITING
            if ticket.status == TicketStatus.IN_PROGRESS:
                ticket.status = TicketStatus.WAITING
                await db.commit()

            # Notifica l'autore del ticket
            creator_result = await db.execute(select(User).where(User.id == ticket.created_by))
            creator = creator_result.scalar_one_or_none()
            if creator and creator.id != current_user.id:
                if creator.email:
                    await notification_service.notify_new_comment(
                        creator.email, ticket.ticket_number, ticket.title, author_name
                    )
                await notification_service.push(
                    db, creator.id,
                    type="ticket_comment",
                    title=f"Nuovo commento sul ticket #{ticket.ticket_number:04d}",
                    body=f"{author_name}: {data.content[:80]}{'...' if len(data.content) > 80 else ''}",
                    ticket_id=ticket.id,
                )
        else:
            # Autore ha commentato → notifica l'assegnato (se presente), altrimenti tutto il team
            if ticket.assigned_to:
                assignee_result = await db.execute(select(User).where(User.id == ticket.assigned_to))
                assignee = assignee_result.scalar_one_or_none()
                if assignee:
                    if assignee.email:
                        await notification_service.notify_new_comment(
                            assignee.email, ticket.ticket_number, ticket.title, author_name
                        )
                    await notification_service.push(
                        db, assignee.id,
                        type="ticket_comment",
                        title=f"Nuovo commento sul ticket #{ticket.ticket_number:04d}",
                        body=f"{author_name}: {data.content[:80]}{'...' if len(data.content) > 80 else ''}",
                        ticket_id=ticket.id,
                    )
            elif ticket.team_id:
                # Nessun assegnato → notifica tutti i membri del team
                members_result = await db.execute(
                    select(TicketTeamMemberModel).where(
                        TicketTeamMemberModel.team_id == ticket.team_id
                    )
                )
                member_ids = [m.user_id for m in members_result.scalars().all()]
                if member_ids:
                    users_result = await db.execute(
                        select(User).where(User.id.in_(member_ids))
                    )
                    team_users = users_result.scalars().all()
                    for member in team_users:
                        if member.email:
                            await notification_service.notify_new_comment(
                                member.email, ticket.ticket_number, ticket.title, author_name
                            )
                        await notification_service.push(
                            db, member.id,
                            type="ticket_comment",
                            title=f"Nuovo commento sul ticket #{ticket.ticket_number:04d}",
                            body=f"{author_name}: {data.content[:80]}{'...' if len(data.content) > 80 else ''}",
                            ticket_id=ticket.id,
                        )
        await db.commit()

    return _enrich_comment(comment, current_user)


async def get_comments(
    db: AsyncSession,
    ticket_id: UUID,
    current_user: User,
    is_manager: bool,
) -> list[CommentResponse]:
    # Verifica accesso al ticket
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.is_active == True)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")
    if not is_manager and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")

    stmt = (
        select(TicketComment)
        .where(TicketComment.ticket_id == ticket_id, TicketComment.is_active == True)
        .order_by(TicketComment.created_at.asc())
    )
    if not is_manager:
        stmt = stmt.where(TicketComment.is_internal == False)

    comments = (await db.execute(stmt)).scalars().all()

    # Carica autori in batch
    author_ids = list({c.author_id for c in comments})
    authors: dict = {}
    if author_ids:
        res = await db.execute(select(User).where(User.id.in_(author_ids)))
        authors = {u.id: u for u in res.scalars().all()}

    return [_enrich_comment(c, authors.get(c.author_id)) for c in comments]
