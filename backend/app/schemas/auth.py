import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.auth import UserRole

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserInfo"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserInfo(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: Optional[str]
    role: UserRole
    
    model_config = {"from_attributes": True}

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.HO

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

TokenResponse.model_rebuild()
