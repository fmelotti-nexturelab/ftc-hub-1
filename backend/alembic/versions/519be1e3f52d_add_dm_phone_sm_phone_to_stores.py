"""add_dm_mail_sm_mail_to_stores

Revision ID: 519be1e3f52d
Revises: mob001_mobile_integration
Create Date: 2026-04-21 11:56:07.031816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '519be1e3f52d'
down_revision: Union[str, Sequence[str], None] = 'mob001_mobile_integration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # rimuove le colonne errate se presenti, poi aggiunge quelle corrette
    op.execute("ALTER TABLE ho.stores DROP COLUMN IF EXISTS dm_phone")
    op.execute("ALTER TABLE ho.stores DROP COLUMN IF EXISTS sm_phone")
    op.add_column('stores', sa.Column('dm_mail', sa.String(200), nullable=True), schema='ho')
    op.add_column('stores', sa.Column('sm_mail', sa.String(200), nullable=True), schema='ho')


def downgrade() -> None:
    op.drop_column('stores', 'sm_mail', schema='ho')
    op.drop_column('stores', 'dm_mail', schema='ho')
