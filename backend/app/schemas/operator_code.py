from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OperatorCodeResponse(BaseModel):
    id: UUID
    code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperatorCodeCreate(BaseModel):
    code: str
    description: Optional[str] = None
