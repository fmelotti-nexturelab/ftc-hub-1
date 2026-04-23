import uuid
from datetime import date

from sqlalchemy import Column, UUID, String, Boolean, DateTime, Date, Text, ForeignKey, Integer
from sqlalchemy.sql import func

from app.database import Base


class OperatorCodeRequest(Base):
    __tablename__ = "operator_code_requests"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    store_number = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_evaded = Column(Boolean, default=False, server_default='false', nullable=False)
    evaded_at = Column(DateTime(timezone=True), nullable=True)
    assigned_code = Column(Integer, nullable=True)
    assigned_password = Column(String(10), nullable=True)
    assigned_email = Column(String(200), nullable=True)
    exported_at = Column(DateTime(timezone=True), nullable=True)
    notification_sent_at = Column(DateTime(timezone=True), nullable=True)


class OperatorCodePool(Base):
    __tablename__ = "operator_code_pool"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity = Column(String(10), nullable=False)
    code = Column(Integer, nullable=False)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())


class OperatorCode(Base):
    __tablename__ = "operator_codes"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    email = Column(String(200), nullable=True)
    start_date = Column(Date, nullable=True)
    store_number = Column(String(20), nullable=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    requested_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
