"""HO: aggiungi scope GLOBAL per nav.credentials.*

Revision ID: c13a06honav01
Revises: c13a05hosales01
Create Date: 2026-03-15 15:00:00.000000

Motivazione: le credenziali NAV sono per-utente/per-ambiente,
non per-entity. Gli endpoint nav-credentials non portano entity
context nella request — il check ENTITY-scoped causa 403 sistematico.
"""

from alembic import op


revision = "c13a06honav01"
down_revision = "c13a05hosales01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN ('nav.credentials.view', 'nav.credentials.manage')
        JOIN auth.scopes s
          ON s.scope_type = 'GLOBAL'
         AND s.scope_code = 'GLOBAL'
        WHERE r.code = 'HO'
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM auth.role_permission_scopes
        WHERE role_id  = (SELECT id FROM auth.roles  WHERE code = 'HO')
          AND scope_id = (SELECT id FROM auth.scopes WHERE scope_type = 'GLOBAL' AND scope_code = 'GLOBAL')
          AND permission_id IN (
              SELECT id FROM auth.permissions
              WHERE code IN ('nav.credentials.view', 'nav.credentials.manage')
          )
        """
    )
