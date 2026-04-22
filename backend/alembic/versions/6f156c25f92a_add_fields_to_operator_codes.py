"""add_fields_to_operator_codes

Revision ID: 6f156c25f92a
Revises: 519be1e3f52d
Create Date: 2026-04-21 15:38:12.074268

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f156c25f92a'
down_revision: Union[str, Sequence[str], None] = '519be1e3f52d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('operator_codes', sa.Column('first_name', sa.String(100), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('last_name', sa.String(100), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('email', sa.String(200), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('start_date', sa.Date(), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('store_number', sa.String(20), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('requested_by', sa.UUID(), nullable=True), schema='ho')
    op.add_column('operator_codes', sa.Column('requested_at', sa.DateTime(timezone=True), nullable=True), schema='ho')
    op.create_foreign_key(
        'fk_operator_codes_requested_by', 'operator_codes', 'users',
        ['requested_by'], ['id'], source_schema='ho', referent_schema='auth'
    )


def downgrade() -> None:
    op.drop_constraint('fk_operator_codes_requested_by', 'operator_codes', schema='ho', type_='foreignkey')
    op.drop_column('operator_codes', 'requested_at', schema='ho')
    op.drop_column('operator_codes', 'requested_by', schema='ho')
    op.drop_column('operator_codes', 'store_number', schema='ho')
    op.drop_column('operator_codes', 'start_date', schema='ho')
    op.drop_column('operator_codes', 'email', schema='ho')
    op.drop_column('operator_codes', 'last_name', schema='ho')
    op.drop_column('operator_codes', 'first_name', schema='ho')
