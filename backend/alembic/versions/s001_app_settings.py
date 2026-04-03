"""app_settings table (already exists from prior session)

Revision ID: s001_app_settings
Revises: op001_operator_code
Create Date: 2026-04-02
"""

revision = "s001_app_settings"
down_revision = "op001_operator_code"
branch_labels = None
depends_on = None


def upgrade():
    # Tabella ho.app_settings già presente nel DB con colonne:
    # id, setting_key, setting_value, description, updated_by, created_at, updated_at
    # e seed ftchub_storage_path + legacy_estrazioni_path
    pass


def downgrade():
    pass
