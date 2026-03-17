from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_config import TicketRoutingRuleModel


async def find_rule(
    db: AsyncSession,
    category_id: int,
    subcategory_id: Optional[int],
) -> Optional[TicketRoutingRuleModel]:
    """
    Cerca la regola di routing più specifica:
    1. Prima cerca match esatto (category_id + subcategory_id)
    2. Se non trovata, cerca match per sola categoria (subcategory_id IS NULL nella regola)
    Restituisce la regola trovata o None.
    """
    # Match esatto con subcategory
    if subcategory_id is not None:
        result = await db.execute(
            select(TicketRoutingRuleModel).where(
                TicketRoutingRuleModel.category_id == category_id,
                TicketRoutingRuleModel.subcategory_id == subcategory_id,
                TicketRoutingRuleModel.is_active == True,
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return rule

    # Fallback: match solo categoria (regola senza subcategory)
    result = await db.execute(
        select(TicketRoutingRuleModel).where(
            TicketRoutingRuleModel.category_id == category_id,
            TicketRoutingRuleModel.subcategory_id == None,
            TicketRoutingRuleModel.is_active == True,
        )
    )
    return result.scalar_one_or_none()
