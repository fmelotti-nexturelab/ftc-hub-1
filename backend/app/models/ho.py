from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Integer, Numeric, UniqueConstraint
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

    



class NavAgentConfig(Base):
    __tablename__ = "nav_agent_config"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(100), nullable=False, unique=True)
    config_value = Column(Text, nullable=False)
    description = Column(String(255))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class NavCredential(Base):
    __tablename__ = "nav_credentials"
    __table_args__ = (
        UniqueConstraint("department", "nav_env", "nav_username", name="uq_nav_cred_dept_env_user"),
        {"schema": "ho"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department = Column(String(50), nullable=False)
    nav_env = Column(String(10), nullable=False)
    nav_username = Column(String(100), nullable=False)
    nav_password_enc = Column(Text, nullable=False)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)


class CheckPrezziLista(Base):
    """
    Lista cambi prezzi correnti ricevuti da casa madre via mail (file xlsx).
    Una riga per ogni item; metadata del caricamento (filename, data, utente)
    sono ridondanti su ogni riga della stessa entity per semplicita'.
    La PUT fa delete + insert atomico per la entity, quindi non c'e' storico.
    """
    __tablename__ = "check_prezzi_lista"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity = Column(String(10), nullable=False, index=True)
    item_number = Column(String(50), nullable=False)
    new_price = Column(Numeric(12, 4), nullable=False)
    old_price = Column(Numeric(12, 4), nullable=True)
    reason = Column(String(255), nullable=True)
    status = Column(String(50), nullable=True)
    source_filename = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)