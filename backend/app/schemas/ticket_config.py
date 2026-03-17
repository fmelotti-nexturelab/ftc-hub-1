from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    sort_order: int
    created_at: Optional[datetime] = None
    subcategory_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ── Subcategory ───────────────────────────────────────────────────────────────

class SubcategoryCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class SubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class SubcategoryResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    sort_order: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str
    email: Optional[str] = None
    description: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TeamResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Team Member ───────────────────────────────────────────────────────────────

class TeamMemberCreate(BaseModel):
    user_id: UUID
    is_team_lead: bool = False


class TeamMemberUpdate(BaseModel):
    is_team_lead: Optional[bool] = None


class TeamMemberResponse(BaseModel):
    id: int
    team_id: int
    user_id: UUID
    is_team_lead: bool
    created_at: Optional[datetime] = None
    username: Optional[str] = None
    full_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── Routing Rule ──────────────────────────────────────────────────────────────

class RoutingRuleCreate(BaseModel):
    category_id: int
    subcategory_id: Optional[int] = None
    team_id: Optional[int] = None
    assigned_user_id: Optional[UUID] = None
    priority_override: Optional[str] = None


class RoutingRuleUpdate(BaseModel):
    team_id: Optional[int] = None
    assigned_user_id: Optional[UUID] = None
    priority_override: Optional[str] = None
    is_active: Optional[bool] = None


class RoutingRuleResponse(BaseModel):
    id: int
    category_id: int
    subcategory_id: Optional[int] = None
    team_id: Optional[int] = None
    assigned_user_id: Optional[UUID] = None
    priority_override: Optional[str] = None
    is_active: bool
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    team_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── Routing Preview ───────────────────────────────────────────────────────────

class RoutingPreviewResponse(BaseModel):
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    priority_override: Optional[str] = None
