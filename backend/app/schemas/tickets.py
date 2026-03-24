from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.tickets import TicketPriority, TicketStatus


# ── Ticket ────────────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title: str
    description: str
    original_description: Optional[str] = None
    category_id: int
    subcategory_id: Optional[int] = None
    priority: TicketPriority
    requester_name: str
    requester_email: Optional[str] = None
    requester_phone: str
    teamviewer_code: str
    team_id: Optional[int] = None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class TicketAssignUpdate(BaseModel):
    assigned_to: Optional[UUID] = None


class TicketForwardUpdate(BaseModel):
    team_id: int


class TicketBulkAction(BaseModel):
    ticket_ids: List[UUID]
    action: str                       # "close" | "status" | "assign"
    status: Optional[str] = None      # usato con action="status"
    assigned_to: Optional[UUID] = None  # usato con action="assign"


class UserBrief(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    department: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketResponse(BaseModel):
    id: UUID
    ticket_number: int
    title: str
    description: str
    original_description: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    team_id: Optional[int] = None
    priority: TicketPriority
    status: TicketStatus
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    teamviewer_code: Optional[str] = None
    store_number: Optional[str] = None
    requester_email: Optional[str] = None
    created_by: UUID
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    taken_at: Optional[datetime] = None
    resolution_minutes: Optional[int] = None
    # Denormalizzati per la UI
    creator_name: Optional[str] = None
    assignee_name: Optional[str] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    team_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    is_internal: bool = False


class CommentResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    author_id: UUID
    content: str
    is_internal: bool
    created_at: datetime
    author_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── Attachments ───────────────────────────────────────────────────────────────

class AttachmentResponse(BaseModel):
    id: UUID
    ticket_id: Optional[UUID] = None
    comment_id: Optional[UUID] = None
    filename: str
    file_size: int
    mime_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Users list (for assign dropdown) ─────────────────────────────────────────

class UserListResponse(BaseModel):
    users: List[UserBrief]
