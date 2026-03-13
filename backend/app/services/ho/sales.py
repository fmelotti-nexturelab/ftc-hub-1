import io
import csv
from datetime import datetime, date
from typing import Optional, List, Dict
from app.schemas.ho import SalesPreview, StoreRow

def parse_italian_number(value: str) -> float:
    if not value or value.strip() in ("", "-"):
        return 0.0
    try:
        # Rimuovi spazi interni, poi converti formato IT
        cleaned = value.strip().replace(" ", "").replace(".", "").replace(",", ".")
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_nav_date(date_str: str) -> Optional[date]:
    """Prova vari formati data NAV: DD-MM-YY, DD.MM.YY, DD/MM/YY"""
    s = date_str.strip()
    for fmt in ("%d-%m-%y", "%d.%m.%y", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None

def is_date_column(header: str) -> bool:
    return parse_nav_date(header) is not None

def parse_tsv_nav(
    raw_tsv: str,
    source: str,
    excluded_store_codes: set,
) -> Optional[SalesPreview]:
    if not raw_tsv or not raw_tsv.strip():
        return None

    today = date.today()

    try:
        reader = csv.reader(io.StringIO(raw_tsv.strip()), delimiter="\t")
        rows = list(reader)
    except Exception:
        return None

    if len(rows) < 2:
        return None

    headers = rows[0]

    # Identifica TUTTE le colonne data (senza filtro data)
    date_col_indices = []
    date_columns = []
    for i, h in enumerate(headers):
        if is_date_column(h):
            date_col_indices.append(i)
            date_columns.append(h.strip())

    # Trova colonne store
    code_idx = None
    name_idx = None
    for i, h in enumerate(headers):
        h_lower = h.strip().lower()
        if h_lower in ("code", "codice", "store", "no.", "no"):
            code_idx = i
        elif h_lower in ("description", "name", "descrizione", "nome"):
            name_idx = i

    if code_idx is None:
        for i, h in enumerate(headers):
            if not is_date_column(h) and h.strip() not in ("+/-", "+", "-", ""):
                code_idx = i
                break

    if code_idx is None:
        code_idx = 1

    if name_idx is None:
        if code_idx + 1 < len(headers) and not is_date_column(headers[code_idx + 1]):
            name_idx = code_idx + 1

    store_rows: List[StoreRow] = []
    missing_stores: List[str] = []
    excluded_in_result: List[str] = []
    total_by_date: Dict[str, float] = {d: 0.0 for d in date_columns}

    for row in rows[1:]:
        if not row or len(row) <= code_idx:
            continue

        store_code = row[code_idx].strip() if len(row) > code_idx else ""
        store_name = row[name_idx].strip() if name_idx and len(row) > name_idx else store_code

        if not store_code or store_code.lower() in ("total", "totale", ""):
            continue

        first_col = row[0].strip() if row else ""
        if first_col == "1":
            continue

        if store_code in excluded_store_codes:
            excluded_in_result.append(store_code)
            continue

        dates_values: Dict[str, float] = {}
        row_total = 0.0
        has_any_data = False

        for date_str, col_idx in zip(date_columns, date_col_indices):
            val = parse_italian_number(row[col_idx]) if col_idx < len(row) else 0.0
            dates_values[date_str] = val
            row_total += val
            if val != 0.0:
                has_any_data = True
            total_by_date[date_str] = total_by_date.get(date_str, 0.0) + val

        if not has_any_data:
            missing_stores.append(store_code)

        store_rows.append(StoreRow(
            store_code=store_code,
            store_name=store_name,
            dates=dates_values,
            total=row_total,
            has_data=has_any_data,
        ))

    grand_total = sum(r.total for r in store_rows)

    return SalesPreview(
        source=source,
        date_columns=date_columns,
        rows=store_rows,
        missing_stores=missing_stores,
        excluded_stores=excluded_in_result,
        total_by_date=total_by_date,
        grand_total=grand_total,
    )