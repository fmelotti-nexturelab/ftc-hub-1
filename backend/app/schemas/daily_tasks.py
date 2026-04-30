from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DailyTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    instructions: Optional[str]
    frequency: str
    sort_order: int
    is_active: bool
    done_today: bool = False
    last_done_at: Optional[datetime] = None
    last_done_by: Optional[str] = None


class CompleteRequest(BaseModel):
    task_ids: list[UUID]
    notes: Optional[str] = None


class CompleteResponse(BaseModel):
    completed: int
    done_at: datetime


class HistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: UUID
    task_name: str
    done_at: datetime
    done_by: Optional[str]
    notes: Optional[str]
