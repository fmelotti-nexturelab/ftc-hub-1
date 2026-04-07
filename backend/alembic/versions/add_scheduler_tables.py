"""Aggiunge tabelle scheduled_jobs e scheduled_job_logs per il Task Scheduler

Revision ID: add_scheduler_001
Revises: fix_ticket_seq_001
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "add_scheduler_001"
down_revision = "fix_ticket_seq_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("cron_expression", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_status", sa.String(20), nullable=True),
        sa.Column("last_run_duration_ms", sa.Integer(), nullable=True),
        sa.Column("last_run_detail", sa.Text(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        schema="ho",
    )

    op.create_table(
        "scheduled_job_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_name", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("records_affected", sa.Integer(), nullable=True),
        schema="ho",
    )

    op.create_index("ix_job_logs_name_started", "scheduled_job_logs", ["job_name", "started_at"], schema="ho")


def downgrade() -> None:
    op.drop_index("ix_job_logs_name_started", table_name="scheduled_job_logs", schema="ho")
    op.drop_table("scheduled_job_logs", schema="ho")
    op.drop_table("scheduled_jobs", schema="ho")
