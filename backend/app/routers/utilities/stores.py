import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, _user_can_access_module
from app.models.auth import User, UserDepartment
from app.models.stores import Store


async def _require_utilities_view(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Verifica accesso al modulo utilities_stores senza check di scope geografico."""
    department = getattr(current_user, "department", None)
    if department in (UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT):
        return current_user
    if not await _user_can_access_module(db, current_user, "utilities_stores", need_manage=False):
        raise HTTPException(403, "Accesso alle utilities non consentito")
    return current_user


async def _require_utilities_manage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Verifica accesso in gestione al modulo utilities_stores."""
    department = getattr(current_user, "department", None)
    if department in (UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT):
        return current_user
    if not await _user_can_access_module(db, current_user, "utilities_stores", need_manage=True):
        raise HTTPException(403, "Gestione utilities non consentita")
    return current_user

router = APIRouter(prefix="/api/utilities/stores", tags=["Utilities - Stores"])


def _serialize(s: Store) -> dict:
    return {
        "id": str(s.id),
        "store_number": s.store_number,
        "store_name": s.store_name,
        "entity": s.entity,
        "district": s.district,
        "city": s.city,
        "location_type": s.location_type,
        "opening_date": s.opening_date.isoformat() if s.opening_date else None,
        "address": s.address,
        "postal_code": s.postal_code,
        "full_address": s.full_address,
        "nav_code": s.nav_code,
        "phone": s.phone,
        "email": s.email,
        "dm_name": s.dm_name,
        "sm_name": s.sm_name,
    }


class StorePayload(BaseModel):
    store_number: str
    store_name: str
    entity: str
    district: Optional[str] = None
    city: Optional[str] = None
    location_type: Optional[str] = None
    opening_date: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    full_address: Optional[str] = None
    nav_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    dm_name: Optional[str] = None
    sm_name: Optional[str] = None


@router.get("/filters", dependencies=[Depends(_require_utilities_view)])
async def get_filters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Store.district, Store.dm_name)
        .where(Store.is_active == True)
        .distinct()
        .order_by(Store.district)
    )
    rows = result.all()
    return {
        "districts": sorted(set(r.district for r in rows if r.district)),
        "dm_names": sorted(set(r.dm_name for r in rows if r.dm_name)),
    }


@router.get("", dependencies=[Depends(_require_utilities_view)])
async def list_stores(
    search: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    dm_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Store).where(Store.is_active == True)
    if entity:
        q = q.where(Store.entity == entity)
    if district:
        q = q.where(Store.district == district)
    if dm_name:
        q = q.where(Store.dm_name == dm_name)
    if search:
        s = f"%{search}%"
        q = q.where(or_(
            Store.store_number.ilike(s),
            Store.store_name.ilike(s),
            Store.city.ilike(s),
            Store.sm_name.ilike(s),
        ))
    result = await db.execute(q.order_by(Store.store_number))
    return [_serialize(s) for s in result.scalars().all()]


@router.post("", dependencies=[Depends(_require_utilities_manage)])
async def create_store(data: StorePayload, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Store).where(Store.store_number == data.store_number))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Store '{data.store_number}' già esistente")
    from datetime import date
    store = Store(
        id=uuid.uuid4(),
        **data.model_dump(exclude={"opening_date"}),
        opening_date=date.fromisoformat(data.opening_date) if data.opening_date else None,
        is_active=True,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return _serialize(store)


@router.put("/{store_id}", dependencies=[Depends(_require_utilities_manage)])
async def update_store(store_id: str, data: StorePayload, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(404, "Store non trovato")
    from datetime import date
    for k, v in data.model_dump(exclude={"opening_date"}).items():
        setattr(store, k, v)
    store.opening_date = date.fromisoformat(data.opening_date) if data.opening_date else None
    await db.commit()
    await db.refresh(store)
    return _serialize(store)


@router.delete("/{store_id}", dependencies=[Depends(_require_utilities_manage)])
async def delete_store(store_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(404, "Store non trovato")
    store.is_active = False
    await db.commit()
    return {"message": "Store eliminato"}
