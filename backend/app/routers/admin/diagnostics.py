import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import User, UserDepartment
from app.core.dependencies import get_current_user, require_permission
from app.config import settings

router = APIRouter(prefix="/api/admin/diagnostics", tags=["Admin - Diagnostics"])


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

    # 1. Database
    try:
        await db.execute(text("SELECT 1"))
        checks.append({
            "name": "Database",
            "description": "PostgreSQL raggiungibile e operativo",
            "status": "ok",
            "detail": "Connessione al database attiva",
        })
    except Exception as e:
        checks.append({
            "name": "Database",
            "description": "PostgreSQL raggiungibile e operativo",
            "status": "error",
            "detail": f"Database non raggiungibile: {str(e)[:80]}",
        })

    # 2. Storage allegati
    attachments_path = getattr(settings, "TICKET_ATTACHMENTS_PATH", "/data/attachments")
    try:
        path_exists = os.path.exists(attachments_path)
        path_writable = os.access(attachments_path, os.W_OK) if path_exists else False
        if path_exists and path_writable:
            checks.append({
                "name": "Storage allegati",
                "description": "Cartella allegati accessibile in lettura/scrittura",
                "status": "ok",
                "detail": f"Percorso {attachments_path} operativo",
            })
        elif path_exists and not path_writable:
            checks.append({
                "name": "Storage allegati",
                "description": "Cartella allegati accessibile in lettura/scrittura",
                "status": "warning",
                "detail": f"Cartella esistente ma non scrivibile: {attachments_path}",
            })
        else:
            checks.append({
                "name": "Storage allegati",
                "description": "Cartella allegati accessibile in lettura/scrittura",
                "status": "warning",
                "detail": f"Cartella non trovata: {attachments_path}",
            })
    except Exception as e:
        checks.append({
            "name": "Storage allegati",
            "description": "Cartella allegati accessibile in lettura/scrittura",
            "status": "warning",
            "detail": f"Errore verifica storage: {str(e)[:80]}",
        })

    # 3. Anthropic API Key
    api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
    if api_key and len(api_key) > 10:
        checks.append({
            "name": "AI (Anthropic)",
            "description": "Chiave API Anthropic configurata",
            "status": "ok",
            "detail": "Chiave API configurata correttamente",
        })
    else:
        checks.append({
            "name": "AI (Anthropic)",
            "description": "Chiave API Anthropic configurata",
            "status": "warning",
            "detail": "Chiave API non configurata — routing AI disabilitato",
        })

    # 4. Almeno un SUPERUSER attivo
    try:
        result = await db.execute(
            select(func.count(User.id)).where(
                User.department == UserDepartment.SUPERUSER,
                User.is_active == True,
            )
        )
        su_count = result.scalar() or 0
        if su_count > 0:
            checks.append({
                "name": "Amministratore",
                "description": "Almeno un utente SUPERUSER attivo nel sistema",
                "status": "ok",
                "detail": f"{su_count} amministratore/i attivo/i",
            })
        else:
            checks.append({
                "name": "Amministratore",
                "description": "Almeno un utente SUPERUSER attivo nel sistema",
                "status": "error",
                "detail": "Nessun utente SUPERUSER attivo — sistema non gestibile",
            })
    except Exception as e:
        checks.append({
            "name": "Amministratore",
            "description": "Almeno un utente SUPERUSER attivo nel sistema",
            "status": "warning",
            "detail": f"Verifica fallita: {str(e)[:80]}",
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
