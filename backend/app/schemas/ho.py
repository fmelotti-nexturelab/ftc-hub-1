from datetime import datetime
from typing import Optional, List, Dict
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.ho import ExclusionReason


class ExcludedStoreCreate(BaseModel):
    store_code: str
    store_name: Optional[str] = None
    reason: ExclusionReason
    notes: Optional[str] = None


class ExcludedStoreResponse(BaseModel):
    id: UUID
    store_code: str
    store_name: Optional[str] = None
    reason: ExclusionReason
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SalesDataInput(BaseModel):
    raw_tsv_it01: Optional[str] = None
    raw_tsv_it02: Optional[str] = None
    raw_tsv_it03: Optional[str] = None


class StoreRow(BaseModel):
    store_code: str
    store_name: str
    dates: Dict
    total: float
    has_data: bool


class SalesPreview(BaseModel):
    source: str
    date_columns: List[str]
    rows: List[StoreRow]
    missing_stores: List[str]
    excluded_stores: List[str]
    total_by_date: Dict
    grand_total: float


class SalesParseResponse(BaseModel):
    it01: Optional[SalesPreview] = None
    it02: Optional[SalesPreview] = None
    it03: Optional[SalesPreview] = None



class NavCredentialCreate(BaseModel):
    nav_env: str
    nav_username: str
    nav_password: str


class NavCredentialUpdate(BaseModel):
    nav_password: str


class NavCredentialResponse(BaseModel):
    id: UUID
    nav_env: str
    nav_username: str
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NavOpenRequest(BaseModel):
    nav_env: str
    rdp_key: str