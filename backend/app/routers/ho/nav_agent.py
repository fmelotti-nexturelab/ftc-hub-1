import io
import os
import zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.auth import User, UserDepartment
from app.models.ho import NavAgentConfig, NavCredential
from app.schemas.ho import (
    NavAgentConfigItem,
    NavAgentConfigResponse,
    NavAgentConfigUpdate,
    NavCredentialCreate,
    NavCredentialUpdatePassword,
    NavCredentialResponse,
)
from app.core.dependencies import require_permission, get_current_user
from app.core.security import encrypt_password, decrypt_password

router = APIRouter(prefix="/api/ho/navision", tags=["HO - Navision"])

RDP_FILES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "rdp_files")
RDP_FILES_DIR = os.path.normpath(RDP_FILES_DIR)

AGENT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "navision_agent")
AGENT_DIR = os.path.normpath(AGENT_DIR)

VALID_RDP_KEYS = {
    "it01_classic": "NAV IT01 Classic",
    "it02_classic": "NAV IT02 Classic",
    "it02_new":     "NAV IT02 New",
    "it03_classic": "NAV IT03 Classic",
    "it03_new":     "NAV IT03 New",
}

_ADMIN_DEPTS = {UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT}


def _is_admin(user: User) -> bool:
    return user.department in _ADMIN_DEPTS


# ── Config ────────────────────────────────────────────────────────────────────

@router.get(
    "/config",
    response_model=NavAgentConfigResponse,
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NavAgentConfig).order_by(NavAgentConfig.config_key)
    )
    items = [NavAgentConfigItem.model_validate(r) for r in result.scalars().all()]
    return NavAgentConfigResponse(items=items)


@router.put(
    "/config",
    response_model=NavAgentConfigResponse,
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def update_config(
    data: NavAgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in data.updates.items():
        result = await db.execute(
            select(NavAgentConfig).where(NavAgentConfig.config_key == key)
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            cfg.config_value = value
            cfg.updated_by = current_user.id

    await db.commit()

    result = await db.execute(
        select(NavAgentConfig).order_by(NavAgentConfig.config_key)
    )
    items = [NavAgentConfigItem.model_validate(r) for r in result.scalars().all()]
    return NavAgentConfigResponse(items=items)


# ── Agent installer download ─────────────────────────────────────────────────

@router.get(
    "/agent-installer",
    dependencies=[Depends(require_permission("navision"))],
)
async def download_agent_installer():
    """Scarica il pacchetto installer dell'agente NAV come zip."""
    files_to_include = [
        ("ftchub_nav_agent.ps1", "ftchub_nav_agent.ps1"),
        ("installa_agente.bat", "installa_agente.bat"),
    ]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for src_name, arc_name in files_to_include:
            src_path = os.path.join(AGENT_DIR, src_name)
            if os.path.isfile(src_path):
                zf.write(src_path, arc_name)

    if buf.tell() == 0:
        raise HTTPException(status_code=404, detail="File agente non trovati")

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=ftchub_nav_agent.zip"},
    )


# ── RDP file download ─────────────────────────────────────────────────────────

@router.get(
    "/rdp/{rdp_key}",
    dependencies=[Depends(require_permission("navision"))],
)
async def download_rdp(rdp_key: str):
    if rdp_key not in VALID_RDP_KEYS:
        raise HTTPException(status_code=404, detail="Chiave RDP non valida")

    path = os.path.join(RDP_FILES_DIR, f"{rdp_key}.rdp")
    if not os.path.isfile(path):
        raise HTTPException(
            status_code=404,
            detail=f"File RDP '{VALID_RDP_KEYS[rdp_key]}' non ancora caricato sul server. Contattare IT.",
        )

    return FileResponse(
        path=path,
        filename=f"nav_{rdp_key}.rdp",
        media_type="application/x-rdp",
    )


@router.post(
    "/rdp/{rdp_key}",
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def upload_rdp(rdp_key: str, file: UploadFile = File(...)):
    if rdp_key not in VALID_RDP_KEYS:
        raise HTTPException(status_code=404, detail="Chiave RDP non valida")

    os.makedirs(RDP_FILES_DIR, exist_ok=True)
    path = os.path.join(RDP_FILES_DIR, f"{rdp_key}.rdp")
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    return {"message": f"File RDP '{VALID_RDP_KEYS[rdp_key]}' caricato con successo"}


# ── Credentials ───────────────────────────────────────────────────────────────

@router.get(
    "/credentials",
    response_model=List[NavCredentialResponse],
    dependencies=[Depends(require_permission("navision"))],
)
async def get_credentials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(NavCredential).where(NavCredential.is_active == True)

    if not _is_admin(current_user):
        query = query.where(NavCredential.department == current_user.department.value)

    query = query.order_by(NavCredential.nav_env, NavCredential.display_order, NavCredential.nav_username)
    result = await db.execute(query)

    creds = result.scalars().all()
    out = []
    for c in creds:
        try:
            pwd = decrypt_password(c.nav_password_enc)
        except Exception:
            pwd = "*** errore decifratura ***"
        out.append(NavCredentialResponse(
            id=c.id,
            department=c.department,
            nav_env=c.nav_env,
            nav_username=c.nav_username,
            nav_password=pwd,
            display_order=c.display_order,
            updated_at=c.updated_at,
        ))
    return out


@router.post(
    "/credentials",
    response_model=NavCredentialResponse,
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def add_credential(
    data: NavCredentialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cred = NavCredential(
        department=data.department.upper(),
        nav_env=data.nav_env.upper(),
        nav_username=data.nav_username,
        nav_password_enc=encrypt_password(data.nav_password),
        display_order=data.display_order,
        created_by=current_user.id,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)

    return NavCredentialResponse(
        id=cred.id,
        department=cred.department,
        nav_env=cred.nav_env,
        nav_username=cred.nav_username,
        nav_password=data.nav_password,
        display_order=cred.display_order,
        updated_at=cred.updated_at,
    )


@router.put(
    "/credentials/{cred_id}/password",
    response_model=NavCredentialResponse,
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def update_credential_password(
    cred_id: str,
    data: NavCredentialUpdatePassword,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NavCredential).where(
            NavCredential.id == cred_id,
            NavCredential.is_active == True,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credenziale non trovata")

    cred.nav_password_enc = encrypt_password(data.nav_password)
    await db.commit()
    await db.refresh(cred)

    return NavCredentialResponse(
        id=cred.id,
        department=cred.department,
        nav_env=cred.nav_env,
        nav_username=cred.nav_username,
        nav_password=data.nav_password,
        display_order=cred.display_order,
        updated_at=cred.updated_at,
    )


@router.delete(
    "/credentials/{cred_id}",
    dependencies=[Depends(require_permission("navision", need_manage=True))],
)
async def delete_credential(
    cred_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NavCredential).where(
            NavCredential.id == cred_id,
            NavCredential.is_active == True,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credenziale non trovata")

    cred.is_active = False
    await db.commit()
    return {"message": "Credenziale rimossa"}
