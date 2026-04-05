"""add check_prezzi_lista table

Revision ID: 7a493e73cc81
Revises: g004_seed_check_prezzi
Create Date: 2026-04-05 12:43:28.043884

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a493e73cc81'
down_revision: Union[str, Sequence[str], None] = 'g004_seed_check_prezzi'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crea la tabella ho.check_prezzi_lista per la lista cambi prezzi correnti."""
    op.create_table(
        "check_prezzi_lista",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity", sa.String(length=10), nullable=False),
        sa.Column("item_number", sa.String(length=50), nullable=False),
        sa.Column("new_price", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("old_price", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["uploaded_by"], ["auth.users.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="ho",
    )
    op.create_index(
        op.f("ix_ho_check_prezzi_lista_entity"),
        "check_prezzi_lista",
        ["entity"],
        unique=False,
        schema="ho",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_ho_check_prezzi_lista_entity"),
        table_name="check_prezzi_lista",
        schema="ho",
    )
    op.drop_table("check_prezzi_lista", schema="ho")
