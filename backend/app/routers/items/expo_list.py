import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User

router = APIRouter(prefix="/api/items", tags=["Items - ExpoList / EcoList"])

_PERM = require_permission("items_view")
_PERM_MANAGE = require_permission("items_view", need_manage=True)


# ── ExpoList ──────────────────────────────────────────────────────────────────

class ExpoItem(BaseModel):
    item_no: str
    expo_type: str


class ExpoSyncRequest(BaseModel):
    items: list[ExpoItem]


@router.get("/expo-list/last-sync", dependencies=[Depends(_PERM)])
async def get_expo_last_sync(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT MAX(synced_at) AS last_sync FROM ho.expo_list"))
    row = result.one_or_none()
    last_sync = row[0] if row and row[0] else None
    return {"last_sync": last_sync.isoformat() if last_sync else None}


@router.post("/expo-list/sync", dependencies=[Depends(_PERM_MANAGE)])
async def sync_expo_list(
    payload: ExpoSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.items:
        return {"synced": 0}

    valid_types = {"TABLE", "WALL", "BUCKET"}
    rows = [
        {"item_no": i.item_no.strip(), "expo_type": i.expo_type.strip().upper()}
        for i in payload.items
        if i.item_no.strip() and i.expo_type.strip().upper() in valid_types
    ]
    if not rows:
        return {"synced": 0}

    now = datetime.now(timezone.utc)
    rows_json = json.dumps(rows)
    uid = str(current_user.id)
    await db.execute(text("TRUNCATE ho.expo_list"))
    await db.execute(
        text("""
            INSERT INTO ho.expo_list (item_no, expo_type, synced_at, synced_by)
            SELECT r.item_no, r.expo_type, :now, CAST(:uid AS uuid)
            FROM jsonb_to_recordset(CAST(:rows AS jsonb)) AS r(item_no text, expo_type text)
        """),
        {"rows": rows_json, "now": now, "uid": uid},
    )
    await db.commit()
    return {"synced": len(rows), "synced_at": now.isoformat()}


# ── EcoList ───────────────────────────────────────────────────────────────────

class EcoSyncRequest(BaseModel):
    items: list[str]


@router.get("/eco-list/last-sync", dependencies=[Depends(_PERM)])
async def get_eco_last_sync(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT MAX(synced_at) AS last_sync FROM ho.eco_list"))
    row = result.one_or_none()
    last_sync = row[0] if row and row[0] else None
    return {"last_sync": last_sync.isoformat() if last_sync else None}


@router.post("/eco-list/sync", dependencies=[Depends(_PERM_MANAGE)])
async def sync_eco_list(
    payload: EcoSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = [s.strip() for s in payload.items if s and s.strip()]
    if not items:
        return {"synced": 0}

    now = datetime.now(timezone.utc)
    rows_json = json.dumps([{"item_no": s} for s in items])
    uid = str(current_user.id)
    await db.execute(text("TRUNCATE ho.eco_list"))
    await db.execute(
        text("""
            INSERT INTO ho.eco_list (item_no, synced_at, synced_by)
            SELECT r.item_no, :now, CAST(:uid AS uuid)
            FROM jsonb_to_recordset(CAST(:rows AS jsonb)) AS r(item_no text)
        """),
        {"rows": rows_json, "now": now, "uid": uid},
    )
    await db.commit()
    return {"synced": len(items), "synced_at": now.isoformat()}


# ── KglList ───────────────────────────────────────────────────────────────────

class KglItem(BaseModel):
    item_no: str
    peso_corretto: float
    kgl_l: float | None = None


class KglSyncRequest(BaseModel):
    items: list[KglItem]


@router.get("/kgl-list/last-sync", dependencies=[Depends(_PERM)])
async def get_kgl_last_sync(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT MAX(synced_at) AS last_sync FROM ho.kgl_list"))
    row = result.one_or_none()
    last_sync = row[0] if row and row[0] else None
    return {"last_sync": last_sync.isoformat() if last_sync else None}


@router.post("/kgl-list/sync", dependencies=[Depends(_PERM_MANAGE)])
async def sync_kgl_list(
    payload: KglSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seen: dict[str, dict] = {}
    for i in payload.items:
        key = i.item_no.strip()
        if key and i.peso_corretto is not None and i.peso_corretto > 0:
            seen[key] = {"peso_corretto": i.peso_corretto, "kgl_l": i.kgl_l}
    rows = [{"item_no": k, **v} for k, v in seen.items()]
    if not rows:
        return {"synced": 0}

    now = datetime.now(timezone.utc)
    rows_json = json.dumps(rows)
    uid = str(current_user.id)
    await db.execute(text("TRUNCATE ho.kgl_list"))
    await db.execute(
        text("""
            INSERT INTO ho.kgl_list (item_no, peso_corretto, kgl_l, synced_at, synced_by)
            SELECT r.item_no,
                   CAST(r.peso_corretto AS numeric),
                   CAST(r.kgl_l AS numeric),
                   :now,
                   CAST(:uid AS uuid)
            FROM jsonb_to_recordset(CAST(:rows AS jsonb))
              AS r(item_no text, peso_corretto numeric, kgl_l numeric)
        """),
        {"rows": rows_json, "now": now, "uid": uid},
    )
    await db.commit()
    return {"synced": len(rows), "synced_at": now.isoformat()}


# ── SalesL2W ──────────────────────────────────────────────────────────────────

class SalesL2WItem(BaseModel):
    item_no: str
    store_code: str
    qty_sold: int


class SalesL2WSyncRequest(BaseModel):
    items: list[SalesL2WItem]
    week_from: str | None = None
    week_to: str | None = None


@router.get("/sales-l2w/last-sync", dependencies=[Depends(_PERM)])
async def get_sales_l2w_last_sync(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text(
        "SELECT MAX(synced_at) AS last_sync, MAX(week_from) AS week_from, MAX(week_to) AS week_to FROM ho.sales_l2w"
    ))
    row = result.one_or_none()
    last_sync = row[0] if row and row[0] else None
    return {
        "last_sync": last_sync.isoformat() if last_sync else None,
        "week_from": row[1] if row else None,
        "week_to":   row[2] if row else None,
    }


@router.post("/sales-l2w/sync", dependencies=[Depends(_PERM_MANAGE)])
async def sync_sales_l2w(
    payload: SalesL2WSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = [
        {"item_no": i.item_no.strip(), "store_code": i.store_code.strip(), "qty_sold": i.qty_sold}
        for i in payload.items
        if i.item_no.strip() and i.store_code.strip() and i.qty_sold > 0
    ]
    if not rows:
        return {"synced": 0}

    now = datetime.now(timezone.utc)
    rows_json = json.dumps(rows)
    uid = str(current_user.id)
    await db.execute(text("TRUNCATE ho.sales_l2w"))
    await db.execute(
        text("""
            INSERT INTO ho.sales_l2w (item_no, store_code, qty_sold, week_from, week_to, synced_at, synced_by)
            SELECT r.item_no, r.store_code, CAST(r.qty_sold AS integer),
                   :week_from, :week_to, :now, CAST(:uid AS uuid)
            FROM jsonb_to_recordset(CAST(:rows AS jsonb))
              AS r(item_no text, store_code text, qty_sold integer)
        """),
        {"rows": rows_json, "now": now, "uid": uid, "week_from": payload.week_from, "week_to": payload.week_to},
    )
    await db.commit()
    return {"synced": len(rows), "synced_at": now.isoformat()}
