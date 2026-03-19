import uuid
import enum

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {"schema": "tickets"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(Integer, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey("tickets.ticket_categories.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("tickets.ticket_subcategories.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("tickets.ticket_teams.id"), nullable=True)
    priority = Column(
        Enum(TicketPriority, schema="tickets", name="ticketpriority",
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    status = Column(
        Enum(TicketStatus, schema="tickets", name="ticketstatus",
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=TicketStatus.OPEN,
    )
    store_number = Column(String(20), nullable=True)  # auto-popolato per STORE/STOREMANAGER
    requester_name = Column(String(255), nullable=False, server_default="")
    requester_email = Column(String(255), nullable=True)
    requester_phone = Column(String(50), nullable=False, server_default="")
    teamviewer_code = Column(String(100), nullable=False, server_default="")
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)


class TicketComment(Base):
    __tablename__ = "ticket_comments"
    __table_args__ = {"schema": "tickets"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.tickets.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    __table_args__ = {"schema": "tickets"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.tickets.id"), nullable=True)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_comments.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
