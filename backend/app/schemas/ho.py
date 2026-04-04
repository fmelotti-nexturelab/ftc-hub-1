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


class ExcludedStoreInfo(BaseModel):
    store_code: str
    reason: str


class SalesPreview(BaseModel):
    source: str
    date_columns: List[str]
    rows: List[StoreRow]
    missing_stores: List[str]
    excluded_stores: List[ExcludedStoreInfo]
    total_by_date: Dict
    grand_total: float


class SalesParseResponse(BaseModel):
    it01: Optional[SalesPreview] = None
    it02: Optional[SalesPreview] = None
    it03: Optional[SalesPreview] = None


class SalesStoreValue(BaseModel):
    store_code: str
    value: float


class SalesExportExcelRequest(BaseModel):
    analysis_date: str  # es. "03.04.26"
    stores: List[SalesStoreValue]



class NavAgentConfigItem(BaseModel):
    config_key: str
    config_value: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NavAgentConfigResponse(BaseModel):
    items: List[NavAgentConfigItem]


class NavAgentConfigUpdate(BaseModel):
    updates: Dict[str, str]


class NavCredentialCreate(BaseModel):
    department: str
    nav_env: str
    nav_username: str
    nav_password: str
    display_order: int = 0


class NavCredentialUpdatePassword(BaseModel):
    nav_password: str


class NavCredentialResponse(BaseModel):
    id: UUID
    department: str
    nav_env: str
    nav_username: str
    nav_password: str  # decrypted, shown to user
    display_order: int
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)