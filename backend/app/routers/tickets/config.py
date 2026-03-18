from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ticket_config import (
    TicketCategoryModel,
    TicketSubcategoryModel,
    TicketRoutingRuleModel,
    TicketTeamModel,
)
from app.schemas.ticket_config import (
    CategoryResponse,
    SubcategoryResponse,
    RoutingPreviewResponse,
)
from app.core.dependencies import require_permission
from app.services.tickets import routing_service

router = APIRouter(prefix="/api/tickets", tags=["Tickets - Config"])


@router.get(
    "/categories",
    response_model=List[CategoryResponse],
    dependencies=[Depends(require_permission("tickets"))],
)
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Lista categorie attive ordinate per sort_order."""
    result = await db.execute(
        select(TicketCategoryModel)
        .where(TicketCategoryModel.is_active == True)
        .order_by(TicketCategoryModel.sort_order, TicketCategoryModel.name)
    )
    categories = result.scalars().all()

    # Conta sottocategorie attive per categoria
    sub_counts_res = await db.execute(
        select(
            TicketSubcategoryModel.category_id,
            func.count(TicketSubcategoryModel.id).label("cnt"),
        )
        .where(TicketSubcategoryModel.is_active == True)
        .group_by(TicketSubcategoryModel.category_id)
    )
    sub_counts = {row.category_id: row.cnt for row in sub_counts_res.all()}

    responses = []
    for cat in categories:
        r = CategoryResponse.model_validate(cat)
        r.subcategory_count = sub_counts.get(cat.id, 0)
        responses.append(r)
    return responses


@router.get(
    "/categories/{category_id}/subcategories",
    response_model=List[SubcategoryResponse],
    dependencies=[Depends(require_permission("tickets"))],
)
async def list_subcategories(
    category_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Sottocategorie attive di una categoria, ordinate per sort_order."""
    result = await db.execute(
        select(TicketSubcategoryModel)
        .where(
            TicketSubcategoryModel.category_id == category_id,
            TicketSubcategoryModel.is_active == True,
        )
        .order_by(TicketSubcategoryModel.sort_order, TicketSubcategoryModel.name)
    )
    return [SubcategoryResponse.model_validate(s) for s in result.scalars().all()]


@router.get(
    "/categories/{category_id}/routing-preview",
    response_model=RoutingPreviewResponse,
    dependencies=[Depends(require_permission("tickets"))],
)
async def routing_preview(
    category_id: int,
    subcategory_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Restituisce il team/utente destinatario per una coppia categoria/sottocategoria."""
    rule = await routing_service.find_rule(db, category_id, subcategory_id)
    if not rule:
        return RoutingPreviewResponse()

    team_name: Optional[str] = None
    if rule.team_id:
        team_res = await db.execute(
            select(TicketTeamModel).where(TicketTeamModel.id == rule.team_id)
        )
        team = team_res.scalar_one_or_none()
        if team:
            team_name = team.name

    return RoutingPreviewResponse(
        team_id=rule.team_id,
        team_name=team_name,
        assigned_user_id=rule.assigned_user_id,
        priority_override=rule.priority_override,
    )
