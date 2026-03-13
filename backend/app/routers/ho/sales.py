from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List

from app.database import get_db
from app.models.auth import User
from app.models.ho import ExcludedStore, NavCredential
from app.schemas.ho import (
    ExcludedStoreCreate,
    ExcludedStoreResponse,
    SalesDataInput,
    SalesParseResponse,
    NavCredentialCreate,
    NavCredentialUpdate,
    NavCredentialResponse,
    NavOpenRequest,
)
from app.services.ho.sales import parse_tsv_nav
from app.core.dependencies import require_ho, require_permission
from app.core.security import encrypt_password, decrypt_password

router = APIRouter(prefix="/api/ho/sales", tags=["HO - Sales"])

# ── Excluded Stores ────────────────────────────────────────────────────────────

@router.get(
    "/excluded-stores",
    response_model=List[ExcludedStoreResponse],
    dependencies=[Depends(require_permission("sales.view"))],
)
async def get_excluded_stores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(ExcludedStore).where(ExcludedStore.is_active == True)
    )
    return [ExcludedStoreResponse.model_validate(s) for s in result.scalars().all()]


@router.post(
    "/excluded-stores",
    response_model=ExcludedStoreResponse,
    dependencies=[Depends(require_permission("stores.exclude_manage"))],
)
async def add_excluded_store(
    data: ExcludedStoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    store = ExcludedStore(**data.model_dump(), created_by=current_user.id)
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return ExcludedStoreResponse.model_validate(store)


@router.delete(
    "/excluded-stores/{store_id}",
    dependencies=[Depends(require_permission("stores.exclude_manage"))],
)
async def remove_excluded_store(
    store_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    await db.execute(
        update(ExcludedStore)
        .where(ExcludedStore.id == store_id)
        .values(is_active=False)
    )
    await db.commit()
    return {"message": "Store rimosso dalla lista esclusi"}


@router.post(
    "/parse",
    response_model=SalesParseResponse,
    dependencies=[Depends(require_permission("sales.import"))],
)
async def parse_sales_data(
    data: SalesDataInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(ExcludedStore).where(ExcludedStore.is_active == True)
    )
    excluded = {s.store_code for s in result.scalars().all()}

    return SalesParseResponse(
        it01=parse_tsv_nav(data.raw_tsv_it01, "IT01", excluded) if data.raw_tsv_it01 else None,
        it02=parse_tsv_nav(data.raw_tsv_it02, "IT02", excluded) if data.raw_tsv_it02 else None,
        it03=parse_tsv_nav(data.raw_tsv_it03, "IT03", excluded) if data.raw_tsv_it03 else None,
    )

# ── NAV Credentials ────────────────────────────────────────────────────────────

@router.get(
    "/nav-credentials",
    response_model=List[NavCredentialResponse],
    dependencies=[Depends(require_permission("nav.credentials.view"))],
)
async def get_nav_credentials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(NavCredential).where(NavCredential.user_id == current_user.id)
    )
    return [NavCredentialResponse.model_validate(c) for c in result.scalars().all()]


@router.post(
    "/nav-credentials",
    response_model=NavCredentialResponse,
    dependencies=[Depends(require_permission("nav.credentials.manage"))],
)
async def upsert_nav_credential(
    data: NavCredentialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(NavCredential).where(
            NavCredential.user_id == current_user.id,
            NavCredential.nav_env == data.nav_env.upper(),
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.nav_username = data.nav_username
        existing.nav_password_enc = encrypt_password(data.nav_password)
        await db.commit()
        await db.refresh(existing)
        return NavCredentialResponse.model_validate(existing)
    else:
        cred = NavCredential(
            user_id=current_user.id,
            nav_env=data.nav_env.upper(),
            nav_username=data.nav_username,
            nav_password_enc=encrypt_password(data.nav_password),
        )
        db.add(cred)
        await db.commit()
        await db.refresh(cred)
        return NavCredentialResponse.model_validate(cred)


@router.put(
    "/nav-credentials/{nav_env}",
    response_model=NavCredentialResponse,
    dependencies=[Depends(require_permission("nav.credentials.manage"))],
)
async def update_nav_password(
    nav_env: str,
    data: NavCredentialUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(NavCredential).where(
            NavCredential.user_id == current_user.id,
            NavCredential.nav_env == nav_env.upper(),
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credenziale non trovata")

    cred.nav_password_enc = encrypt_password(data.nav_password)
    await db.commit()
    await db.refresh(cred)
    return NavCredentialResponse.model_validate(cred)


@router.post(
    "/nav-open",
    dependencies=[Depends(require_permission("nav.credentials.manage"))],
)
async def nav_open(
    data: NavOpenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_ho),
):
    result = await db.execute(
        select(NavCredential).where(
            NavCredential.user_id == current_user.id,
            NavCredential.nav_env == data.nav_env.upper(),
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail=f"Credenziali NAV {data.nav_env} non configurate")

    import httpx
    pwd = decrypt_password(cred.nav_password_enc)

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "http://host.docker.internal:9999/open-rdp",
                json={
                    "key": data.rdp_key,
                    "username": cred.nav_username,
                    "password": pwd,
                    "server": "R46-BR1.R46.LOCAL",
                },
                timeout=10.0,
            )
            return r.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Agent non raggiungibile: {str(e)}")