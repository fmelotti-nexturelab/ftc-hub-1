"""
Genera il file Excel ItemList da dati TSV (anagrafe ITEM IT02/IT03).

File generati:
 1. yyyymmdd_{entity}_ItemList.xlsx -> [storage]/02_ItemList/Archivio/  (sempre)
 2. yyyymmdd - Item ({entity}).xlsx -> restituito come bytes per legacy save (frontend)
"""

import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.app_settings_service import get_storage_path

logger = logging.getLogger(__name__)

VALID_ENTITIES = {"IT02", "IT03"}


def _parse_tsv_rows(rows: list[list[str]]) -> tuple[list[str], list[list[str]]]:
    """
    Riceve righe TSV (lista di liste di stringhe).
    Ritorna (headers, data_rows) saltando eventuali header duplicati.
    """
    if not rows:
        raise ValueError("Nessun dato fornito")

    headers = rows[0]
    start_idx = 1

    # Skip double header if present
    if len(rows) > 2:
        h0 = (headers[0] or "").strip().lower()
        h2 = (rows[1][0] or "").strip().lower()
        if h0 == h2:
            start_idx = 2

    data_rows = [r for r in rows[start_idx:] if any((c or "").strip() for c in r)]
    if not data_rows:
        raise ValueError("Nessun articolo trovato nei dati")

    return headers, data_rows


def _to_int(val: str):
    """Converte stringa in intero, ritorna il valore originale se non possibile."""
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(float(str(val).replace(",", ".")))
    except (ValueError, TypeError):
        return val


def _to_decimal(val: str):
    """Converte stringa in float, ritorna il valore originale se non possibile."""
    if val is None or str(val).strip() == "":
        return None
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return val


# Formattazione colonne per entity (0-based: A=0, B=1, ...)
_ENTITY_INT_COLS = {
    "IT02": {3, 8},     # D, I → intero senza decimali
    "IT03": {4, 7},     # E, H → intero senza decimali
}
_ENTITY_DECIMAL_COLS = {
    "IT02": {4, 5},     # E, F → numero con 2 decimali
    "IT03": {6},        # G → numero con 2 decimali
}


def _write_xlsx_bytes(
    sheet_name: str,
    headers: list[str],
    rows: list[list[str]],
    int_cols: set[int] | None = None,
    decimal_cols: set[int] | None = None,
) -> bytes:
    """Genera un file .xlsx in memoria e ritorna i bytes."""
    int_cols = int_cols or set()
    decimal_cols = decimal_cols or set()
    wb = Workbook(write_only=True)
    ws = wb.create_sheet(sheet_name)
    ws.append(headers)
    for row in rows:
        converted = []
        for col_idx, val in enumerate(row):
            if col_idx in int_cols:
                converted.append(_to_int(val))
            elif col_idx in decimal_cols:
                converted.append(_to_decimal(val))
            else:
                converted.append(val)
        ws.append(converted)
    buf = BytesIO()
    wb.save(buf)
    wb.close()
    buf.seek(0)
    return buf.read()


async def generate_itemlist(
    entity: str,
    rows: list[list[str]],
    db: AsyncSession,
) -> dict:
    """
    Genera il file ItemList per l'entity (IT02 o IT03):
    1. Salva yyyymmdd_{entity}_ItemList.xlsx nell'archivio storage
    2. Ritorna i bytes del file per il legacy save dal frontend
    """
    if entity not in VALID_ENTITIES:
        raise ValueError(f"Entity non supportata: {entity}")

    headers, data_rows = _parse_tsv_rows(rows)
    date_str = datetime.now().strftime("%Y%m%d")

    # Genera bytes Excel con formattazione colonne specifica per entity
    int_cols = _ENTITY_INT_COLS.get(entity, set())
    decimal_cols = _ENTITY_DECIMAL_COLS.get(entity, set())
    xlsx_bytes = _write_xlsx_bytes(f"ItemList {entity}", headers, data_rows, int_cols, decimal_cols)

    # Salva nell'archivio storage
    storage_path = await get_storage_path(db)
    base = Path(storage_path)
    if not base.exists():
        raise ValueError(f"La cartella FTC HUB Storage non esiste: {storage_path}")

    archivio_dir = base / "02_ItemList" / "Archivio"
    archivio_dir.mkdir(parents=True, exist_ok=True)

    archivio_name = f"{date_str}_{entity}_ItemList.xlsx"
    archivio_path = archivio_dir / archivio_name
    archivio_path.write_bytes(xlsx_bytes)
    logger.info("Scritto %s (%d righe)", archivio_path, len(data_rows))

    return {
        "archivio_path": str(archivio_path),
        "row_count": len(data_rows),
        "xlsx_bytes": xlsx_bytes,
        "legacy_filename": f"{date_str} - Item ({entity}).xlsx",
    }
