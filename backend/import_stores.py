"""Script one-shot: importa stores da Excel in ho.stores"""
import asyncio
import uuid
from datetime import datetime
import openpyxl
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.stores import Store

EXCEL_PATH = "/app/cartel1.xlsx"


async def main():
    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    data = rows[1:]

    async with AsyncSessionLocal() as db:
        imported = 0
        skipped = 0
        for row in data:
            if not row[0]:
                continue

            store_number = str(row[0]).strip()

            # Salta se già esiste
            existing = await db.execute(select(Store).where(Store.store_number == store_number))
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            opening_date = None
            if row[5] and isinstance(row[5], datetime):
                opening_date = row[5].date()

            store = Store(
                id=uuid.uuid4(),
                store_number=store_number,
                store_name=str(row[1]).strip() if row[1] else "",
                entity=store_number[:4],  # IT01, IT02, IT03
                district=str(row[2]).strip() if row[2] else None,
                city=str(row[3]).strip() if row[3] else None,
                location_type=str(row[4]).strip() if row[4] else None,
                opening_date=opening_date,
                address=str(row[6]).strip() if row[6] else None,
                postal_code=str(row[7]).strip() if row[7] else None,
                nav_code=str(row[8]).strip() if row[8] else None,
                dm_name=str(row[9]).strip() if row[9] else None,
                sm_name=str(row[10]).strip() if row[10] else None,
                phone=str(row[11]).strip() if row[11] else None,
                email=str(row[12]).strip() if row[12] else None,
                full_address=str(row[13]).strip() if row[13] else None,
                is_active=True,
            )
            db.add(store)
            imported += 1

        await db.commit()
        print(f"Import completato: {imported} inseriti, {skipped} già presenti.")


asyncio.run(main())
