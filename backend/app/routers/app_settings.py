from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.app_settings import AppSetting
from app.models.auth import User

router = APIRouter(prefix="/api/settings", tags=["Settings"])

_PERM = require_permission("system.admin")


class SettingUpdate(BaseModel):
    value: str | None = None


@router.get("", dependencies=[Depends(_PERM)])
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).order_by(AppSetting.setting_key))
    rows = result.scalars().all()
    return {r.setting_key: r.setting_value for r in rows}


@router.get("/{key}", dependencies=[Depends(_PERM)])
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).where(AppSetting.setting_key == key))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"Impostazione '{key}' non trovata")
    return {"key": row.setting_key, "value": row.setting_value, "description": row.description}


@router.put("/{key}", dependencies=[Depends(_PERM)])
async def update_setting(
    key: str,
    body: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AppSetting).where(AppSetting.setting_key == key))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"Impostazione '{key}' non trovata")
    row.setting_value = body.value
    row.updated_by = current_user.id
    await db.commit()
    return {"key": row.setting_key, "value": row.setting_value}
