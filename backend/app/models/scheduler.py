import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, UUID
from sqlalchemy.sql import func
from app.database import Base


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    cron_expression = Column(String(50), nullable=False)  # es. "0 12 * * *"
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(20), nullable=True)  # ok, error
    last_run_duration_ms = Column(Integer, nullable=True)
    last_run_detail = Column(Text, nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ScheduledJobLog(Base):
    __tablename__ = "scheduled_job_logs"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_name = Column(String(100), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False)  # ok, error
    detail = Column(Text, nullable=True)
    records_affected = Column(Integer, nullable=True)
