"""merge_heads_before_store_number

Revision ID: 18cc564d65c4
Revises: a1b2c3d4e5f6, d70fde3370d5
Create Date: 2026-03-19 11:54:39.599856

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18cc564d65c4'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'd70fde3370d5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
