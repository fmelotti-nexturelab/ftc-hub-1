from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_settings import AppSetting


async def get_setting_value(db: AsyncSession, key: str) -> str | None:
    """Legge un valore da ho.app_settings. Ritorna None se non trovato o vuoto."""
    result = await db.execute(
        select(AppSetting.setting_value).where(AppSetting.setting_key == key)
    )
    val = result.scalar_one_or_none()
    return val if val else None


async def get_storage_path(db: AsyncSession) -> str:
    """Ritorna il path FTC HUB Storage configurato. Solleva ValueError se non impostato."""
    path = await get_setting_value(db, "ftchub_storage_path")
    if not path:
        raise ValueError(
            "Path FTC HUB Storage non configurato. "
            "Vai in Impostazioni e inserisci il percorso della cartella."
        )
    return path
