from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ItemImportSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity: str
    imported_at: datetime
    imported_by: Optional[str] = None  # username, joined in service
    batch_id: str
    row_count: int
    source_filename: Optional[str]
    is_current: bool


class ImportResultResponse(BaseModel):
    session_id: int
    entity: str
    batch_id: str
    row_count: int
    source_filename: Optional[str]
    is_current: bool
    imported_at: datetime
