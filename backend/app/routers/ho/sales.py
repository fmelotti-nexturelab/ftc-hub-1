from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.auth import User
from app.models.ho import ExcludedStore
from app.schemas.ho import (
    ExcludedStoreCreate,
    ExcludedStoreResponse,
    SalesDataInput,
    SalesParseResponse,
)
from app.services.ho.sales import parse_tsv_nav
from app.core.dependencies import require_ho, require_permission

router = APIRouter(prefix="/api/ho/sales", tags=["HO - Sales"])

# ── Excluded Stores ────────────────────────────────────────────────────────────

@router.get(
    "/excluded-stores",
    response_model=List[ExcludedStoreResponse],
    dependencies=[Depends(require_permission("sales.view"))],
)
async def get_excluded_stores(
    db: AsyncSession = Depends(get_db),
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
):
    result = await db.execute(
        select(ExcludedStore).where(
            ExcludedStore.id == store_id,
            ExcludedStore.is_active == True,
        )
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store non trovato")

    store.is_active = False
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
):
    result = await db.execute(
        select(ExcludedStore).where(ExcludedStore.is_active == True)
    )
    excluded = {s.store_code.upper() for s in result.scalars().all()}

    return SalesParseResponse(
        it01=parse_tsv_nav(data.raw_tsv_it01, "IT01", excluded) if data.raw_tsv_it01 else None,
        it02=parse_tsv_nav(data.raw_tsv_it02, "IT02", excluded) if data.raw_tsv_it02 else None,
        it03=parse_tsv_nav(data.raw_tsv_it03, "IT03", excluded) if data.raw_tsv_it03 else None,
    )

