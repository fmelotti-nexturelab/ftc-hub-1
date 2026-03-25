"""deactivate_modules_moved_to_utilities

Revision ID: 819c86a2f31b
Revises: f002_add_store_codes
Create Date: 2026-03-25 22:11:09.326282

Sales Data, Item List, Stock, Ordini, File FTP vengono gestiti tramite
Utilities Config — vengono disattivati dalla pagina Accesso Moduli.
Il backend continua a funzionare: department_module_access non ha FK su
ho.modules, quindi i record di accesso esistenti restano intatti.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '819c86a2f31b'
down_revision: Union[str, Sequence[str], None] = 'f002_add_store_codes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CODES = ('sales', 'item_list', 'stock', 'ordini', 'file_ftp')


def upgrade() -> None:
    op.execute(
        f"UPDATE ho.modules SET is_active = FALSE "
        f"WHERE code IN {CODES}"
    )


def downgrade() -> None:
    op.execute(
        f"UPDATE ho.modules SET is_active = TRUE "
        f"WHERE code IN {CODES}"
    )
