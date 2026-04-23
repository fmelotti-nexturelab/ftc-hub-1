import base64
import io
from datetime import date
from pathlib import Path
from typing import List

import xlrd
import xlwt
from xlutils.copy import copy as xl_copy

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEMPLATES_DIR = BASE_DIR / "migtool_templates"
TEMPLATE_RETAIL = TEMPLATES_DIR / "migtool_RetailStaff_25009704.xls"
TEMPLATE_POS = TEMPLATES_DIR / "migtool_POSstaff_25009709.xls"


def _build_retail_staff(entity: str, rows: list, today: date) -> tuple[str, bytes]:
    rb = xlrd.open_workbook(str(TEMPLATE_RETAIL), formatting_info=True)
    wb = xl_copy(rb)
    ws = wb.get_sheet(0)
    base_row = 3  # riga 4 (0-indexed)

    for i, row in enumerate(rows):
        code = str(int(row["assigned_code"])) if row["assigned_code"] else ""
        name = f"{row['last_name']} {row['first_name']}"
        pwd = str(row["assigned_password"]) if row["assigned_password"] else ""
        ws.write(base_row + i, 0, code)
        ws.write(base_row + i, 1, name)
        ws.write(base_row + i, 2, "")
        ws.write(base_row + i, 3, pwd)

    buf = io.BytesIO()
    wb.save(buf)
    filename = f"{today.strftime('%Y%m%d')}_{entity}_migtool_RetailStaff_25009704.xls"
    return filename, buf.getvalue()


def _build_pos_staff(entity: str, rows: list, today: date) -> tuple[str, bytes]:
    rb = xlrd.open_workbook(str(TEMPLATE_POS), formatting_info=True)
    wb = xl_copy(rb)
    ws = wb.get_sheet(0)
    base_row = 3  # riga 4 (0-indexed)

    for i, row in enumerate(rows):
        code = str(int(row["assigned_code"])) if row["assigned_code"] else ""
        ws.write(base_row + i, 0, "All")
        ws.write(base_row + i, 1, "")
        ws.write(base_row + i, 2, code)
        ws.write(base_row + i, 3, code)
        ws.write(base_row + i, 4, "")

    buf = io.BytesIO()
    wb.save(buf)
    filename = f"{today.strftime('%Y%m%d')}_{entity}_migtool_POSstaff_25009709.xls"
    return filename, buf.getvalue()


def generate_nav_files(entity: str, rows: list) -> List[dict]:
    """Genera la coppia di file in memoria. Ritorna lista di {filename, content_b64}."""
    today = date.today()
    results = []
    for filename, content in [
        _build_retail_staff(entity, rows, today),
        _build_pos_staff(entity, rows, today),
    ]:
        results.append({
            "filename": filename,
            "entity": entity,
            "content_b64": base64.b64encode(content).decode("ascii"),
        })
    return results
