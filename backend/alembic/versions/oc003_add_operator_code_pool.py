"""add operator_code_pool table

Revision ID: oc003_add_operator_code_pool
Revises: oc002_add_evaded_fields
Create Date: 2026-04-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'oc003_add_operator_code_pool'
down_revision: Union[str, Sequence[str], None] = 'oc002_add_evaded_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'operator_code_pool',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity', sa.String(10), nullable=False),
        sa.Column('code', sa.Integer(), nullable=False),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema='ho',
    )
    op.create_index('ix_operator_code_pool_entity_code', 'operator_code_pool',
                    ['entity', 'code'], unique=True, schema='ho')


def downgrade() -> None:
    op.drop_index('ix_operator_code_pool_entity_code', table_name='operator_code_pool', schema='ho')
    op.drop_table('operator_code_pool', schema='ho')
