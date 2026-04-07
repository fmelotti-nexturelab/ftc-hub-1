"""
Digest giornaliero ticket — invia a ogni utente un riepilogo
dei ticket aperti assegnati a lui, ordinati per priorità e anzianità.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select, text, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.tickets import Ticket
from app.services.tickets import notification_service

logger = logging.getLogger(__name__)

PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
PRIORITY_LABELS = {"critical": "Critica", "high": "Alta", "medium": "Media", "low": "Bassa"}
PRIORITY_COLORS = {
    "critical": "#dc2626",
    "high": "#ea580c",
    "medium": "#2563eb",
    "low": "#6b7280",
}


def _format_age(created_at: datetime) -> str:
    """Formatta l'età del ticket in modo leggibile."""
    now = datetime.now(timezone.utc)
    delta = now - created_at
    days = delta.days
    hours = delta.seconds // 3600
    if days > 0:
        return f"{days}g {hours}h"
    return f"{hours}h"


def _build_email_html(user_name: str, tickets: list) -> str:
    """Genera il body HTML della mail digest."""
    rows = ""
    for t in tickets:
        priority = t.priority if isinstance(t.priority, str) else t.priority.value
        color = PRIORITY_COLORS.get(priority, "#6b7280")
        label = PRIORITY_LABELS.get(priority, priority)
        age = _format_age(t.created_at)
        status = t.status if isinstance(t.status, str) else t.status.value
        rows += f"""
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px;font-weight:600">#{t.ticket_number:04d}</td>
          <td style="padding:8px 12px">
            <span style="background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">{label}</span>
          </td>
          <td style="padding:8px 12px">{t.title}</td>
          <td style="padding:8px 12px;color:#6b7280;font-size:12px">{status}</td>
          <td style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right">{age}</td>
        </tr>"""

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:16px 24px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:16px">Riepilogo Ticket — {datetime.now().strftime('%d/%m/%Y')}</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.7">Ciao {user_name}, hai {len(tickets)} ticket aperti assegnati a te.</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb">
              <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px">#</th>
              <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px">Priorità</th>
              <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px">Titolo</th>
              <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px">Stato</th>
              <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px">Aperto da</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">
        FTC HUB — Flying Tiger Copenhagen
      </p>
    </div>"""


async def run_digest(db: AsyncSession) -> dict:
    """
    Invia il digest giornaliero a ogni utente con ticket aperti assegnati.
    Ritorna { users_notified: int, tickets_total: int }.
    """
    # Trova tutti i ticket aperti (non chiusi) assegnati a qualcuno
    # Cast esplicito per evitare conflitti con Enum PostgreSQL
    priority_order = text("""
        CASE priority::text
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
        END
    """)
    result = await db.execute(
        select(Ticket)
        .where(
            Ticket.is_active == True,
            cast(Ticket.status, String).in_(["open", "in_progress", "waiting"]),
            Ticket.assigned_to != None,
        )
        .order_by(priority_order, Ticket.created_at.asc())
    )
    all_tickets = result.scalars().all()

    if not all_tickets:
        logger.info("Digest: nessun ticket aperto assegnato — skip")
        return {"users_notified": 0, "tickets_total": 0}

    # Raggruppa per utente assegnato
    by_user: dict = {}
    for t in all_tickets:
        by_user.setdefault(t.assigned_to, []).append(t)

    # Carica utenti
    user_ids = list(by_user.keys())
    users_result = await db.execute(
        select(User).where(User.id.in_(user_ids), User.is_active == True)
    )
    users = {u.id: u for u in users_result.scalars().all()}

    users_notified = 0
    for user_id, tickets in by_user.items():
        user = users.get(user_id)
        if not user or not user.email:
            continue

        user_name = user.full_name or user.username
        html = _build_email_html(user_name, tickets)

        await notification_service.send_email(
            to=user.email,
            subject=f"[FTC HUB] Riepilogo ticket — {len(tickets)} aperti — {datetime.now().strftime('%d/%m/%Y')}",
            body=html,
        )
        users_notified += 1
        logger.info(f"Digest inviato a {user.email} ({len(tickets)} ticket)")

    return {"users_notified": users_notified, "tickets_total": len(all_tickets)}
