import uuid

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "tickets"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    type = Column(String(50), nullable=False)        # ticket_new | ticket_status | ticket_comment | ticket_assigned
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.tickets.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
