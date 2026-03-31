from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class ExclusionReason(str, enum.Enum):
    CLOSED = "CLOSED"
    RESTYLING = "RESTYLING"
    NEW_OPENING = "NEW OPENING"


class ExcludedStore(Base):
    __tablename__ = "excluded_stores"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_code = Column(String(20), nullable=False)
    store_name = Column(String(100))
    reason = Column(Enum(ExclusionReason, schema="ho"), nullable=False)
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)


class SalesSession(Base):
    __tablename__ = "sales_sessions"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    raw_data_it01 = Column(Text)
    raw_data_it02 = Column(Text)
    raw_data_it03 = Column(Text)
    notes = Column(Text)

    


class NavRdpConfig(Base):
    __tablename__ = "nav_rdp_configs"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department = Column(String(50), nullable=False)
    nav_env = Column(String(20), nullable=False)
    server_host = Column(String(200), nullable=False)
    nav_username = Column(String(150), nullable=False)
    nav_password_enc = Column(Text, nullable=False)
    display_label = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)


class NavCredential(Base):
    __tablename__ = "nav_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", "nav_env", name="uq_nav_cred_user_env"),
        {"schema": "ho"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    nav_env = Column(String(10), nullable=False)
    nav_username = Column(String(100), nullable=False)
    nav_password_enc = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())