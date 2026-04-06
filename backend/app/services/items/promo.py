from sqlalchemy.ext.asyncio import AsyncSession
from app.models.items import ItemPromo
from app.services.items.item_generic import get_all, replace_all


async def get_all_promo(db: AsyncSession):
    return await get_all(db, ItemPromo)


async def replace_all_promo(db: AsyncSession, rows: list[dict]) -> int:
    return await replace_all(db, ItemPromo, rows)
