from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.models.ticket_config import TicketCategoryModel, TicketSubcategoryModel, TicketTeamModel
from app.services.tickets import chat_service

router = APIRouter(prefix="/api/tickets/chat", tags=["Tickets - Chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    complete: bool
    ticket_data: Optional[dict] = None


class AnalyzeRequest(BaseModel):
    title: str
    description: str


class SuggestedTeam(BaseModel):
    id: int
    name: str


class AnalyzeResponse(BaseModel):
    relevant: bool
    rejection_reason: Optional[str] = None
    suggested_teams: Optional[List[SuggestedTeam]] = None
    all_teams: Optional[List[SuggestedTeam]] = None
    enhanced_description: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    priority: Optional[str] = None


@router.get(
    "/status",
    dependencies=[Depends(require_permission("tickets"))],
)
async def chat_status():
    return {"available": chat_service.is_available()}


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(require_permission("tickets"))],
)
async def analyze(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    # Carica categorie + sottocategorie
    cat_res = await db.execute(
        select(TicketCategoryModel).where(TicketCategoryModel.is_active == True).order_by(TicketCategoryModel.name)
    )
    categories_db = cat_res.scalars().all()
    sub_res = await db.execute(
        select(TicketSubcategoryModel).where(TicketSubcategoryModel.is_active == True)
    )
    subs_by_cat: dict[int, list] = {}
    for s in sub_res.scalars().all():
        subs_by_cat.setdefault(s.category_id, []).append({"id": s.id, "name": s.name})
    categories = [
        {"id": c.id, "name": c.name, "subcategories": subs_by_cat.get(c.id, [])}
        for c in categories_db
    ]

    # Carica team dal DB
    team_res = await db.execute(
        select(TicketTeamModel).where(TicketTeamModel.is_active == True).order_by(TicketTeamModel.name)
    )
    teams_db = team_res.scalars().all()
    team_map = {t.name.upper(): t for t in teams_db}
    teams = [{"id": t.id, "name": t.name} for t in teams_db]

    all_teams = [SuggestedTeam(id=t.id, name=t.name) for t in teams_db]

    try:
        result = await chat_service.analyze_ticket(body.title, body.description, categories, teams)
    except Exception:
        # Se AI non disponibile, lascia passare il ticket senza analisi (selezione manuale)
        return AnalyzeResponse(relevant=True, suggested_teams=[], all_teams=all_teams, enhanced_description=body.description)

    if not result.get("relevant"):
        return AnalyzeResponse(relevant=False, rejection_reason=result.get("rejection_reason"))

    # Mappa i nomi team suggeriti agli oggetti DB
    suggested = []
    for name in result.get("suggested_teams", []):
        if isinstance(name, str):
            team = team_map.get(name.upper())
            if team:
                suggested.append(SuggestedTeam(id=team.id, name=team.name))

    # Valida category_id e subcategory_id contro gli ID reali nel DB
    valid_cat_ids = {c["id"] for c in categories}
    ai_category_id = result.get("category_id")
    category_id = ai_category_id if ai_category_id in valid_cat_ids else (categories[0]["id"] if categories else None)

    valid_sub_ids = {s["id"] for c in categories for s in c.get("subcategories", [])}
    ai_subcategory_id = result.get("subcategory_id")
    subcategory_id = ai_subcategory_id if ai_subcategory_id in valid_sub_ids else None

    return AnalyzeResponse(
        relevant=True,
        suggested_teams=suggested,
        all_teams=all_teams,
        enhanced_description=result.get("enhanced_description", body.description),
        category_id=category_id,
        subcategory_id=subcategory_id,
        priority=result.get("priority", "medium"),
    )


@router.post(
    "",
    response_model=ChatResponse,
    dependencies=[Depends(require_permission("tickets"))],
)
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not chat_service.is_available():
        raise HTTPException(status_code=503, detail="AI non disponibile")

    # Carica categorie + sottocategorie per il system prompt
    cat_res = await db.execute(
        select(TicketCategoryModel).where(TicketCategoryModel.is_active == True).order_by(TicketCategoryModel.name)
    )
    categories_db = cat_res.scalars().all()

    sub_res = await db.execute(
        select(TicketSubcategoryModel).where(TicketSubcategoryModel.is_active == True)
    )
    subs_by_cat: dict[int, list] = {}
    for s in sub_res.scalars().all():
        subs_by_cat.setdefault(s.category_id, []).append({"id": s.id, "name": s.name})

    categories = [
        {
            "id": c.id,
            "name": c.name,
            "subcategories": subs_by_cat.get(c.id, []),
        }
        for c in categories_db
    ]

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        result = await chat_service.chat(messages, categories)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="AI non disponibile")

    return ChatResponse(**result)
