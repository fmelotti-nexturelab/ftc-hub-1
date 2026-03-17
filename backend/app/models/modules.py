import uuid
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    has_view = Column(Boolean, nullable=False, default=True)
    has_manage = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserTypeModuleAccess(Base):
    __tablename__ = "user_type_module_access"
    __table_args__ = (
        UniqueConstraint("user_type", "module_code", name="uq_usertype_module"),
        {"schema": "ho"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_type = Column(String(20), nullable=False)
    module_code = Column(String(50), nullable=False)
    can_view = Column(Boolean, nullable=False, default=False)
    can_manage = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserModulePermission(Base):
    __tablename__ = "user_module_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "module_code", name="uq_user_module"),
        {"schema": "auth"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    module_code = Column(String(50), nullable=False)
    can_view = Column(Boolean, nullable=True)     # None = usa default user_type
    can_manage = Column(Boolean, nullable=True)   # None = usa default user_type
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
