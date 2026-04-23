from datetime import datetime, date
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OperatorCodeRequestResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    store_number: str
    start_date: date
    notes: Optional[str] = None
    requested_by: Optional[UUID] = None
    requester_name: Optional[str] = None
    created_at: datetime
    is_evaded: bool = False
    evaded_at: Optional[datetime] = None
    suggested_email: Optional[str] = None
    assigned_code: Optional[int] = None
    assigned_password: Optional[str] = None
    assigned_email: Optional[str] = None
    exported_at: Optional[datetime] = None
    notification_sent_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PendingRequestsResponse(BaseModel):
    items: List[OperatorCodeRequestResponse]
    ticket_status: Optional[str] = None


class OperatorCodeResponse(BaseModel):
    id: UUID
    code: Optional[str] = None
    description: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[date] = None
    store_number: Optional[str] = None
    requested_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkRequestRow(BaseModel):
    first_name: str
    last_name: str
    store_number: str
    start_date: Optional[str] = None  # stringa grezza, validata nel router


class BulkRequestPayload(BaseModel):
    rows: List[BulkRequestRow]


class BulkRowResult(BaseModel):
    first_name: str
    last_name: str
    store_number: str
    start_date: Optional[str] = None
    status: str   # "inserted" | "exists" | "pending" | "error"
    note: str


class EvadiPayload(BaseModel):
    email: Optional[str] = None


class NotifyResultItem(BaseModel):
    request_id: str
    first_name: str
    last_name: str
    store_number: str
    sm_name: Optional[str] = None
    sm_mail: Optional[str] = None
    sm_sent: bool = False
    dm_name: Optional[str] = None
    dm_mail: Optional[str] = None
    dm_sent: bool = False
    error: Optional[str] = None


class NotifyResponse(BaseModel):
    sent: int
    skipped: int
    results: List[NotifyResultItem]


class OperatorCodeCreate(BaseModel):
    code: str
    description: Optional[str] = None


class OperatorCodeRequestPayload(BaseModel):
    first_name: str
    last_name: str
    store_number: str
    start_date: date
    force: bool = False
