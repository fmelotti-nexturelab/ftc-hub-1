import logging
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import partial

from app.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to: str, subject: str, body: str) -> None:
    """Invia email via SMTP (sincrono, da eseguire in thread pool)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to], msg.as_string())


async def send_email(to: str, subject: str, body: str) -> None:
    """Wrapper asincrono best-effort — non solleva eccezioni."""
    if not settings.SMTP_HOST or not settings.SMTP_FROM or not to:
        logger.debug("SMTP non configurato — notifica saltata")
        return
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, partial(_send_sync, to, subject, body))
    except Exception as exc:
        logger.warning(f"Notifica email fallita verso {to}: {exc}")


async def notify_new_ticket(ticket_number: int, title: str, creator_name: str) -> None:
    if not settings.TICKET_NOTIFY_EMAIL:
        return
    await send_email(
        to=settings.TICKET_NOTIFY_EMAIL,
        subject=f"[FTC HUB] Nuovo ticket #{ticket_number:04d}: {title}",
        body=(
            f"<p>Nuovo ticket aperto da <strong>{creator_name}</strong>.</p>"
            f"<p><strong>#{ticket_number:04d}</strong> — {title}</p>"
        ),
    )


async def notify_status_change(
    to_email: str, ticket_number: int, title: str, new_status: str
) -> None:
    await send_email(
        to=to_email,
        subject=f"[FTC HUB] Ticket #{ticket_number:04d} aggiornato: {new_status}",
        body=(
            f"<p>Il tuo ticket <strong>#{ticket_number:04d} — {title}</strong> "
            f"è stato aggiornato allo stato: <strong>{new_status}</strong>.</p>"
        ),
    )


async def notify_new_comment(
    to_email: str, ticket_number: int, title: str, author_name: str
) -> None:
    await send_email(
        to=to_email,
        subject=f"[FTC HUB] Nuovo commento sul ticket #{ticket_number:04d}",
        body=(
            f"<p><strong>{author_name}</strong> ha commentato il ticket "
            f"<strong>#{ticket_number:04d} — {title}</strong>.</p>"
        ),
    )


async def notify_team(
    team_email: str, ticket_number: int, title: str, creator_name: str
) -> None:
    """Notifica il team di supporto di un nuovo ticket assegnato."""
    await send_email(
        to=team_email,
        subject=f"[FTC HUB] Nuovo ticket assegnato al team #{ticket_number:04d}: {title}",
        body=(
            f"<p>È stato aperto un nuovo ticket da <strong>{creator_name}</strong> "
            f"assegnato al vostro team.</p>"
            f"<p><strong>#{ticket_number:04d}</strong> — {title}</p>"
        ),
    )
