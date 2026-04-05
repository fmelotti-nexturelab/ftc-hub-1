from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CheckPrezziListaItem(BaseModel):
    """Una riga della lista cambi prezzi."""
    model_config = ConfigDict(from_attributes=True)

    item_number: str = Field(..., max_length=50)
    new_price: Decimal
    old_price: Optional[Decimal] = None
    reason: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=50)


class CheckPrezziListaMeta(BaseModel):
    """Metadata dell'ultimo caricamento (comuni a tutte le righe dell'entity)."""
    source_filename: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    uploaded_by: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None


class CheckPrezziListaResponse(BaseModel):
    """Risposta GET: righe + metadata caricamento."""
    entity: str
    items: List[CheckPrezziListaItem]
    meta: CheckPrezziListaMeta


class CheckPrezziListaReplace(BaseModel):
    """Body della PUT: sostituisce completamente la lista per quella entity."""
    source_filename: Optional[str] = Field(None, max_length=255)
    items: List[CheckPrezziListaItem]
