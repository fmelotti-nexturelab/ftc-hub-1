from sqlalchemy import Column, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class FileArchive(Base):
    __tablename__ = "file_archive"
    __table_args__ = (
        UniqueConstraint("file_type", "entity", "file_date", name="uq_file_archive_type_entity_date"),
        {"schema": "ho"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_type = Column(String(50), nullable=False)   # STOCK_NAV, ITEMLIST, ORDINI, ...
    entity = Column(String(10), nullable=False)       # IT01, IT02, IT03
    file_date = Column(Date, nullable=False)
    file_path = Column(String(500), nullable=True)    # percorso relativo in FTC HUB Storage
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
