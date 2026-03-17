from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.auth import User
from app.models.ho import NavAgentConfig
from app.schemas.ho import NavAgentConfigItem, NavAgentConfigResponse, NavAgentConfigUpdate
from app.core.dependencies import require_permission, get_current_user

router = APIRouter(prefix="/api/ho/nav-agent", tags=["HO - NAV Agent"])


@router.get(
    "/config",
    response_model=NavAgentConfigResponse,
    dependencies=[Depends(require_permission("nav.credentials.view"))],
)
async def get_nav_agent_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NavAgentConfig).order_by(NavAgentConfig.config_key)
    )
    items = [NavAgentConfigItem.model_validate(r) for r in result.scalars().all()]
    return NavAgentConfigResponse(items=items)


@router.put(
    "/config",
    response_model=NavAgentConfigResponse,
    dependencies=[Depends(require_permission("nav.credentials.manage"))],
)
async def update_nav_agent_config(
    data: NavAgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in data.updates.items():
        result = await db.execute(
            select(NavAgentConfig).where(NavAgentConfig.config_key == key)
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            cfg.config_value = value
            cfg.updated_by = current_user.id

    await db.commit()

    result = await db.execute(
        select(NavAgentConfig).order_by(NavAgentConfig.config_key)
    )
    items = [NavAgentConfigItem.model_validate(r) for r in result.scalars().all()]
    return NavAgentConfigResponse(items=items)
