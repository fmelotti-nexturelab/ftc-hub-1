"""add stores.exclude_manage permission

Revision ID: c13a03stores01
Revises: c13a02rbacseed
Create Date: 2026-03-15 12:00:00.000000

"""

from alembic import op


revision = "c13a03stores01"
down_revision = "c13a02rbacseed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # Permesso stores.exclude_manage
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.permissions (id, code, name, description, module, is_active)
        SELECT gen_random_uuid(), x.code, x.name, x.description, x.module, true
        FROM (
            VALUES (
                'stores.exclude_manage',
                'Stores Exclude Manage',
                'Manage excluded stores list',
                'stores'
            )
        ) AS x(code, name, description, module)
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.permissions p WHERE p.code = x.code
        )
        """
    )

    # -------------------------------------------------------------------------
    # Assegna il permesso al ruolo HO
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'stores.exclude_manage'
        WHERE r.code = 'HO'
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )

    # -------------------------------------------------------------------------
    # Scope: HO -> stores.exclude_manage su ENTITY IT01 / IT02 / IT03
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'stores.exclude_manage'
        JOIN auth.scopes s
          ON s.scope_type = 'ENTITY'
         AND s.scope_code IN ('IT01', 'IT02', 'IT03')
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
        WHERE permission_id = (
            SELECT id FROM auth.permissions WHERE code = 'stores.exclude_manage'
        )
        """
    )

    op.execute(
        """
        DELETE FROM auth.role_permissions
        WHERE permission_id = (
            SELECT id FROM auth.permissions WHERE code = 'stores.exclude_manage'
        )
        """
    )

    op.execute(
        """
        DELETE FROM auth.permissions WHERE code = 'stores.exclude_manage'
        """
    )
