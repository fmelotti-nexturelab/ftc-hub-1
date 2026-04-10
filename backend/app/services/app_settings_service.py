from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.app_settings import AppSetting


async def get_setting_value(db: AsyncSession, key: str) -> str | None:
    """Legge un valore da ho.app_settings. Ritorna None se non trovato o vuoto."""
    result = await db.execute(
        select(AppSetting.setting_value).where(AppSetting.setting_key == key)
    )
    val = result.scalar_one_or_none()
    return val if val else None


def get_storage_path() -> str:
    """
    Ritorna il path FTC HUB Storage configurato via env (FILE_STORAGE_PATH).
    È il percorso *interno al container Docker* (es. /mnt/f/FTC_HUB_Archivio),
    non il percorso lato host Windows. Solleva ValueError se non impostato.
    """
    path = settings.FILE_STORAGE_PATH
    if not path:
        raise ValueError(
            "FILE_STORAGE_PATH non configurato. "
            "Impostalo nell'environment del container backend (docker-compose)."
        )
    return path
