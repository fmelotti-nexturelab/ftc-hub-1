from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.core.security import decrypt_password, encrypt_password
from app.database import get_db
from app.models.auth import User, UserDepartment
from app.models.ho import NavRdpConfig
from app.schemas.ho import (
    NavRdpConfigCreate,
    NavRdpConfigResponse,
    NavRdpConfigUpdate,
    NavRdpParamsResponse,
)

router = APIRouter(prefix="/api/navision", tags=["Navision"])

_PERM = require_permission("navision")

_IT_DEPTS = {UserDepartment.IT, UserDepartment.SUPERUSER, UserDepartment.ADMIN}


def _can_manage(user: User) -> bool:
    return getattr(user, "department", None) in _IT_DEPTS


def _dept_filter(query, user: User):
    """IT/SUPERUSER/ADMIN vedono tutto, gli altri solo il proprio department."""
    if getattr(user, "department", None) not in _IT_DEPTS:
        query = query.where(NavRdpConfig.department == user.department.value)
    return query


# ---------------------------------------------------------------------------
# GET /configs  — lista configurazioni accessibili all'utente
# ---------------------------------------------------------------------------

@router.get("/configs", response_model=list[NavRdpConfigResponse], dependencies=[Depends(_PERM)])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(NavRdpConfig).where(NavRdpConfig.is_active == True)
    stmt = _dept_filter(stmt, current_user)
    stmt = stmt.order_by(NavRdpConfig.nav_env, NavRdpConfig.department)
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /rdp-params/{id}  — credenziali decifrate per il lancio RDP
# ---------------------------------------------------------------------------

@router.get("/rdp-params/{config_id}", response_model=NavRdpParamsResponse, dependencies=[Depends(_PERM)])
async def get_rdp_params(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(NavRdpConfig).where(NavRdpConfig.id == config_id, NavRdpConfig.is_active == True)
    stmt = _dept_filter(stmt, current_user)
    result = await db.execute(stmt)
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configurazione non trovata")
    return NavRdpParamsResponse(
        server_host=cfg.server_host,
        nav_username=cfg.nav_username,
        nav_password=decrypt_password(cfg.nav_password_enc),
    )


# ---------------------------------------------------------------------------
# POST /configs  — crea nuova config (solo IT/ADMIN)
# ---------------------------------------------------------------------------

@router.post("/configs", response_model=NavRdpConfigResponse, dependencies=[Depends(_PERM)])
async def create_config(
    data: NavRdpConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Solo IT/ADMIN possono gestire le configurazioni NAV")
    cfg = NavRdpConfig(
        department=data.department,
        nav_env=data.nav_env,
        server_host=data.server_host,
        nav_username=data.nav_username,
        nav_password_enc=encrypt_password(data.nav_password),
        display_label=data.display_label,
        created_by=current_user.id,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg


# ---------------------------------------------------------------------------
# PUT /configs/{id}  — aggiorna config (solo IT/ADMIN)
# ---------------------------------------------------------------------------

@router.put("/configs/{config_id}", response_model=NavRdpConfigResponse, dependencies=[Depends(_PERM)])
async def update_config(
    config_id: str,
    data: NavRdpConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Solo IT/ADMIN possono gestire le configurazioni NAV")
    result = await db.execute(select(NavRdpConfig).where(NavRdpConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configurazione non trovata")
    if data.server_host is not None:
        cfg.server_host = data.server_host
    if data.nav_username is not None:
        cfg.nav_username = data.nav_username
    if data.nav_password is not None:
        cfg.nav_password_enc = encrypt_password(data.nav_password)
    if data.display_label is not None:
        cfg.display_label = data.display_label
    if data.is_active is not None:
        cfg.is_active = data.is_active
    await db.commit()
    await db.refresh(cfg)
    return cfg


# ---------------------------------------------------------------------------
# DELETE /configs/{id}  — soft delete (solo IT/ADMIN)
# ---------------------------------------------------------------------------

@router.delete("/configs/{config_id}", dependencies=[Depends(_PERM)])
async def delete_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Solo IT/ADMIN possono gestire le configurazioni NAV")
    result = await db.execute(select(NavRdpConfig).where(NavRdpConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configurazione non trovata")
    cfg.is_active = False
    await db.commit()
    return {"message": "Configurazione eliminata"}
