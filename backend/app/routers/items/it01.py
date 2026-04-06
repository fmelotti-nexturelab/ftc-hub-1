import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.models.items import ItemImportSession
from app.services.items.it01 import get_items_it01, get_sessions_it01, import_items_it01
from app.services.items.file_generator import generate_itemlist_files
from app.services.app_settings_service import get_storage_path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/items/it01", tags=["Items - IT01"])

_PERM_VIEW   = require_permission("items_view")
_PERM_IMPORT = require_permission("items_view", need_manage=True)


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



@router.post("/sessions/{session_id}/generate-files", dependencies=[Depends(_PERM_IMPORT)])
async def generate_files(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await generate_itemlist_files(session_id=session_id, db=db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return result


@router.get("/download-tbl", dependencies=[Depends(_PERM_VIEW)])
async def download_tbl_xlsm(db: AsyncSession = Depends(get_db)):
    """Scarica il file tbl_ItemM.xlsm generato — usato dal frontend per legacy save."""
    storage_path = await get_storage_path(db)
    tbl_path = Path(storage_path) / "02_ItemList" / "tbl_ItemM.xlsm"
    if not tbl_path.exists():
        raise HTTPException(status_code=404, detail="File tbl_ItemM.xlsm non trovato")
    return FileResponse(
        path=str(tbl_path),
        filename="tbl_ItemM.xlsm",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/tbl-info", dependencies=[Depends(_PERM_VIEW)])
async def tbl_info(db: AsyncSession = Depends(get_db)):
    """Metadati del file tbl_ItemM.xlsm + info su chi l'ha generato."""
    storage_path = await get_storage_path(db)
    tbl_path = Path(storage_path) / "02_ItemList" / "tbl_ItemM.xlsm"
    if not tbl_path.exists():
        return {"exists": False}

    stat = tbl_path.stat()
    created_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

    # La sessione corrente IT01 è quella che ha generato il file
    result = await db.execute(
        select(ItemImportSession)
        .where(ItemImportSession.entity == "IT01", ItemImportSession.is_current.is_(True))
    )
    session = result.scalar_one_or_none()

    created_by = None
    row_count = None
    if session:
        row_count = session.row_count
        if session.imported_by:
            user_result = await db.execute(
                select(User).where(User.id == session.imported_by)
            )
            user = user_result.scalar_one_or_none()
            if user:
                created_by = f"{user.first_name} {user.last_name}".strip() or user.email

    return {
        "exists": True,
        "filename": "tbl_ItemM.xlsm",
        "created_at": created_at,
        "row_count": row_count,
        "created_by": created_by,
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
