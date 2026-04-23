import logging
import smtplib
import asyncio
from datetime import date
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import partial
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


# ── Email ─────────────────────────────────────────────────────────────────────

def _send_sync(to: str, subject: str, body: str, from_header: Optional[str] = None) -> None:
    """Invia email via SMTP (sincrono, da eseguire in thread pool)."""
    effective_from = from_header or settings.SMTP_FROM
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = effective_from
    msg["To"] = to
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to], msg.as_string())


async def send_email(
    to: str,
    subject: str,
    body: str,
    from_header: Optional[str] = None,
) -> None:
    """Wrapper asincrono best-effort — non solleva eccezioni.

    from_header: sovrascrive il campo From visibile al destinatario (es. "Mario Rossi <m.rossi@...>").
    L'autenticazione SMTP usa sempre SMTP_USER/SMTP_PASSWORD da settings.
    """
    if not settings.SMTP_HOST or not settings.SMTP_FROM or not to:
        logger.debug("SMTP non configurato — notifica saltata")
        return
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, partial(_send_sync, to, subject, body, from_header))
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


def _build_operator_code_email(
    recipient_name: str,
    store_number: str,
    store_name: str,
    first_name: str,
    last_name: str,
    assigned_code: int,
    assigned_password: str,
    assigned_email: Optional[str],
    start_date: Optional[date],
) -> str:
    start_date_str = start_date.strftime("%d/%m/%Y") if start_date else "—"
    email_row = (
        f"""<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            <strong style="color:#1e3a5f;">{assigned_email}</strong>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            <strong>Tiger2023!</strong>
            <span style="font-size:11px;color:#9ca3af;margin-left:6px;">(cambiare al primo utilizzo)</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;">
            <a href="https://webmail.aruba.it/" style="color:#2563eb;text-decoration:none;">
              webmail.aruba.it
            </a>
          </td>
        </tr>"""
        if assigned_email
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1px;">
                    flying tiger <span style="font-weight:300;">copenhagen</span>
                  </div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:0.5px;">
                    SOUTH EUROPE — IT DEPARTMENT
                  </div>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 14px;display:inline-block;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.8);font-weight:600;letter-spacing:0.5px;">
                      CODICE OPERATORE
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- STORE BADGE -->
        <tr>
          <td style="background:#2563eb;padding:12px 32px;">
            <span style="font-size:13px;color:#ffffff;font-weight:700;">
              {store_number}
            </span>
            <span style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:8px;">
              {store_name}
            </span>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px;">

            <p style="margin:0 0 6px;font-size:16px;color:#111827;">Ciao <strong>{recipient_name}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              ti informiamo che è stato assegnato un nuovo codice operatore per il negozio
              <strong style="color:#1e3a5f;">{store_number}</strong>.
            </p>

            <!-- OPERATORE TABLE -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:0.8px;text-transform:uppercase;">
              Dati Operatore
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#1e3a5f;">
                  <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;">CODICE</th>
                  <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;">NOME</th>
                  <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;">COGNOME</th>
                  <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;">PASSWORD NAV</th>
                  <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;">DATA INIZIO</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#f8fafc;">
                  <td style="padding:12px 14px;font-size:15px;font-weight:700;color:#1e3a5f;">{assigned_code}</td>
                  <td style="padding:12px 14px;font-size:14px;color:#111827;">{first_name}</td>
                  <td style="padding:12px 14px;font-size:14px;color:#111827;">{last_name}</td>
                  <td style="padding:12px 14px;font-size:15px;font-weight:700;color:#111827;font-family:monospace;">{assigned_password}</td>
                  <td style="padding:12px 14px;font-size:14px;color:#111827;">{start_date_str}</td>
                </tr>
              </tbody>
            </table>

            {"<!-- CREDENZIALI EMAIL --><p style='margin:24px 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:0.8px;text-transform:uppercase;'>Credenziali Email Aziendale</p><table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;'><thead><tr style='background:#1e3a5f;'><th style='padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;'>EMAIL</th><th style='padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;'>PASSWORD INIZIALE</th><th style='padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;letter-spacing:0.5px;'>WEBMAIL</th></tr></thead><tbody>" + email_row + "</tbody></table>" if assigned_email else ""}

            <!-- NAV NOTE -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
                  <span style="font-size:13px;color:#92400e;line-height:1.5;">
                    <strong>Nota:</strong> il codice potrebbe risultare disponibile dal giorno successivo
                    a causa delle code di trasferimento di NAV.
                  </span>
                </td>
              </tr>
            </table>

            <!-- FIRMA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:24px;">
              <tr>
                <td>
                  <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1e3a5f;">Fausto Melotti</p>
                  <p style="margin:0 0 2px;font-size:13px;color:#6b7280;">IT Specialist — Flying Tiger Copenhagen South Europe</p>
                  <p style="margin:0 0 2px;font-size:12px;color:#9ca3af;">Mob: +39 329 7433380</p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    E-mail: <a href="mailto:faumel@flyingtiger.com" style="color:#2563eb;text-decoration:none;">faumel@flyingtiger.com</a>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
              Messaggio generato automaticamente da <strong>FTC HUB</strong> — Flying Tiger Copenhagen South Europe.<br>
              Zebra A/S processes your personal data in accordance with our Privacy Policy.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def notify_operator_code_assigned(
    store_number: str,
    store_name: str,
    sm_name: Optional[str],
    sm_mail: Optional[str],
    dm_name: Optional[str],
    dm_mail: Optional[str],
    first_name: str,
    last_name: str,
    assigned_code: int,
    assigned_password: str,
    assigned_email: Optional[str],
    start_date: Optional[date],
    sender_name: Optional[str] = None,
    sender_email: Optional[str] = None,
) -> None:
    """Invia email a SM e DM del negozio con i dati del nuovo operatore."""
    subject = f"[FTC HUB] Nuovo operatore assegnato — {store_number}"
    from_header = (
        f"{sender_name} <{sender_email}>"
        if sender_name and sender_email
        else (sender_email or None)
    )
    recipients = [
        (sm_name or "Store Manager", sm_mail),
        (dm_name or "District Manager", dm_mail),
    ]
    for recipient_name, recipient_mail in recipients:
        if not recipient_mail:
            continue
        body = _build_operator_code_email(
            recipient_name=recipient_name,
            store_number=store_number,
            store_name=store_name,
            first_name=first_name,
            last_name=last_name,
            assigned_code=assigned_code,
            assigned_password=assigned_password,
            assigned_email=assigned_email,
            start_date=start_date,
        )
        await send_email(to=recipient_mail, subject=subject, body=body, from_header=from_header)


# ── In-app notifications ───────────────────────────────────────────────────────

async def push(
    db: AsyncSession,
    user_id: UUID,
    type: str,
    title: str,
    body: Optional[str] = None,
    ticket_id: Optional[UUID] = None,
) -> None:
    """Scrive una notifica in-app per un utente. Best-effort, non solleva eccezioni."""
    try:
        from app.models.notification import Notification
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            ticket_id=ticket_id,
        )
        db.add(notif)
        # Non fa commit — il chiamante gestisce la transazione
    except Exception as exc:
        logger.warning(f"Notifica in-app fallita per user {user_id}: {exc}")


async def push_to_many(
    db: AsyncSession,
    user_ids: list[UUID],
    type: str,
    title: str,
    body: Optional[str] = None,
    ticket_id: Optional[UUID] = None,
) -> None:
    """Scrive la stessa notifica in-app per una lista di utenti."""
    for uid in user_ids:
        await push(db, uid, type, title, body=body, ticket_id=ticket_id)
