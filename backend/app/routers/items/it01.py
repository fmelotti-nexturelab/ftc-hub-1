from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.services.items.it01 import get_items_it01, get_sessions_it01, import_items_it01

router = APIRouter(prefix="/api/items/it01", tags=["Items - IT01"])

_PERM_VIEW   = require_permission("items.view")
_PERM_IMPORT = require_permission("items.import")


@router.post("/import", dependencies=[Depends(_PERM_IMPORT)])
async def upload_items(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Il file deve essere un XLSX")

    content = await file.read()
    try:
        session = await import_items_it01(
            file_bytes=content,
            source_filename=file.filename,
            imported_by=current_user.id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "session_id": session.id,
        "entity": session.entity,
        "batch_id": session.batch_id,
        "row_count": session.row_count,
        "source_filename": session.source_filename,
        "is_current": session.is_current,
        "imported_at": session.imported_at.isoformat(),
    }


@router.get("/sessions", dependencies=[Depends(_PERM_VIEW)])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    sessions = await get_sessions_it01(db)
    return [
        {
            "id": s.id,
            "entity": s.entity,
            "imported_at": s.imported_at.isoformat(),
            "batch_id": s.batch_id,
            "row_count": s.row_count,
            "source_filename": s.source_filename,
            "is_current": s.is_current,
        }
        for s in sessions
    ]


def _f(val):
    """Converte Numeric/Decimal in float, None altrimenti."""
    return float(val) if val is not None else None


def _serialize_item(i):
    return {
        "id": i.id,
        "item_no": i.item_no,
        "description": i.description,
        "description_local": i.description_local,
        "unit_price": _f(i.unit_price),
        "barcode": i.barcode,
        "units_per_pack": i.units_per_pack,
        "model_store": i.model_store,
        "category": i.category,
        "vat_pct": _f(i.vat_pct),
        "description2": i.description2,
    }


def _serialize_item_full(i):
    """Tutti i campi del DB — usato per l'export."""
    return {
        "item_no":           i.item_no,
        "description":       i.description,
        "description_local": i.description_local,
        "warehouse":         i.warehouse,
        "last_cost":         _f(i.last_cost),
        "unit_price":        _f(i.unit_price),
        "item_cat":          i.item_cat,
        "net_weight":        _f(i.net_weight),
        "barcode":           i.barcode,
        "vat_code":          i.vat_code,
        "units_per_pack":    i.units_per_pack,
        "model_store":       i.model_store,
        "batteries":         i.batteries,
        "first_rp":          i.first_rp,
        "category":          i.category,
        "barcode_ext":       i.barcode_ext,
        "vat_pct":           _f(i.vat_pct),
        "gm_pct":            _f(i.gm_pct),
        "description1":      i.description1,
        "description2":      i.description2,
    }


@router.get("/sessions/{session_id}/items", dependencies=[Depends(_PERM_VIEW)])
async def list_items(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None),
    model_store: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort_by: str = Query(default="item_no"),
    sort_dir: str = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    result = await get_items_it01(
        db=db,
        session_id=session_id,
        search=search,
        model_store=model_store,
        category=category,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return {
        "total": result["total"],
        "page": page,
        "page_size": page_size,
        "items": [_serialize_item(i) for i in result["items"]],
    }


@router.get("/sessions/{session_id}/export", dependencies=[Depends(_PERM_VIEW)])
async def export_items(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None),
    model_store: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort_by: str = Query(default="item_no"),
    sort_dir: str = Query(default="asc"),
):
    result = await get_items_it01(
        db=db,
        session_id=session_id,
        search=search,
        model_store=model_store,
        category=category,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=1,
        page_size=100_000,
    )
    return [_serialize_item_full(i) for i in result["items"]]
