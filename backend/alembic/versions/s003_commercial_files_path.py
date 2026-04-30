"""Aggiunge commercial_files_path ad app_settings

Revision ID: s003_commercial_files_path
Revises: v009_converter_assembly_tables
Create Date: 2026-04-30
"""
from alembic import op

revision = "s003_commercial_files_path"
down_revision = "v009_converter_assembly_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO ho.app_settings (id, setting_key, setting_value, description)
        VALUES (
            gen_random_uuid(),
            'commercial_files_path',
            'Zebra A S\\One Italy Commercial - Files',
            'Percorso relativo alla home utente della cartella One Italy Commercial - Files (SharePoint sync). Usato dagli script locali (price_sync.py, ecc.) per costruire il percorso completo: C:\\Users\\{USERNAME}\\{questo valore}'
        )
        ON CONFLICT (setting_key) DO NOTHING
    """)


def downgrade():
    op.execute("DELETE FROM ho.app_settings WHERE setting_key = 'commercial_files_path'")
