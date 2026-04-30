import uuid
import enum
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class TaskFrequency(str, enum.Enum):
    daily = "daily"
    monday = "monday"
    weekly = "weekly"


class DailyTask(Base):
    __tablename__ = "daily_tasks"
    __table_args__ = {"schema": "ho"}

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code       = Column(String(50), nullable=False, unique=True)
    name       = Column(String(200), nullable=False)
    instructions = Column(Text, nullable=True)
    frequency  = Column(String(20), nullable=False, default="daily")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DailyTaskLog(Base):
    __tablename__ = "daily_task_logs"
    __table_args__ = {"schema": "ho"}

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id    = Column(UUID(as_uuid=True), ForeignKey("ho.daily_tasks.id", ondelete="CASCADE"), nullable=False)
    done_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    done_by    = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)
    notes      = Column(String(500), nullable=True)
