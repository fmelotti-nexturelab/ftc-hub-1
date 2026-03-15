"""seed initial rbac data

Revision ID: c13a02rbacseed
Revises: c13a01rbac01
Create Date: 2026-03-15 03:40:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "c13a02rbacseed"
down_revision = "c13a01rbac01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # ROLES
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.roles (id, code, name, is_active)
        SELECT gen_random_uuid(), x.code, x.name, true
        FROM (
            VALUES
                ('ADMIN', 'Administrator'),
                ('HO', 'Head Office'),
                ('DM', 'District Manager'),
                ('STORE', 'Store User'),
                ('SERVICE', 'Service User')
        ) AS x(code, name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM auth.roles r
            WHERE r.code = x.code
        )
        """
    )

    # -------------------------------------------------------------------------
    # PERMISSIONS
    # NOTE:
    # Dal tuo schema reale permissions ha almeno:
    # id, code, name, description, module, is_active, created_at
    # con "name" NOT NULL.
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.permissions (id, code, name, description, module, is_active)
        SELECT gen_random_uuid(), x.code, x.name, x.description, x.module, true
        FROM (
            VALUES
                ('system.admin', 'System Admin', 'Full system access', 'system'),

                ('sales.view', 'Sales View', 'View sales data', 'sales'),
                ('sales.import', 'Sales Import', 'Import sales data', 'sales'),
                ('sales.export', 'Sales Export', 'Export sales data', 'sales'),

                ('inventory.view', 'Inventory View', 'View inventory data', 'inventory'),
                ('inventory.edit', 'Inventory Edit', 'Edit inventory data', 'inventory'),

                ('users.manage', 'Users Manage', 'Manage users', 'users'),

                ('nav.credentials.view', 'NAV Credentials View', 'View NAV credentials', 'nav'),
                ('nav.credentials.manage', 'NAV Credentials Manage', 'Manage NAV credentials', 'nav')
        ) AS x(code, name, description, module)
        WHERE NOT EXISTS (
            SELECT 1
            FROM auth.permissions p
            WHERE p.code = x.code
        )
        """
    )

    # -------------------------------------------------------------------------
    # EXTRA STORE SCOPES DEMO
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.scopes (
            id, scope_type, scope_code, description, entity_code, store_code, module_code, is_active
        )
        SELECT gen_random_uuid(), x.scope_type, x.scope_code, x.description, x.entity_code, x.store_code, x.module_code, true
        FROM (
            VALUES
                ('STORE', 'IT207', 'Store IT207', NULL, 'IT207', NULL),
                ('STORE', 'IT208', 'Store IT208', NULL, 'IT208', NULL),
                ('STORE', 'IT315', 'Store IT315', NULL, 'IT315', NULL)
        ) AS x(scope_type, scope_code, description, entity_code, store_code, module_code)
        WHERE NOT EXISTS (
            SELECT 1
            FROM auth.scopes s
            WHERE s.scope_type = x.scope_type
              AND s.scope_code = x.scope_code
        )
        """
    )

    # -------------------------------------------------------------------------
    # ROLE -> PERMISSION
    # -------------------------------------------------------------------------

    # ADMIN
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'system.admin'
        WHERE r.code = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permissions rp
              WHERE rp.role_id = r.id
                AND rp.permission_id = p.id
          )
        """
    )

    # HO
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN (
            'sales.view',
            'sales.import',
            'sales.export',
            'nav.credentials.view',
            'nav.credentials.manage'
          )
        WHERE r.code = 'HO'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permissions rp
              WHERE rp.role_id = r.id
                AND rp.permission_id = p.id
          )
        """
    )

    # DM
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN (
            'sales.view',
            'inventory.view'
          )
        WHERE r.code = 'DM'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permissions rp
              WHERE rp.role_id = r.id
                AND rp.permission_id = p.id
          )
        """
    )

    # STORE
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN (
            'inventory.view',
            'inventory.edit'
          )
        WHERE r.code = 'STORE'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permissions rp
              WHERE rp.role_id = r.id
                AND rp.permission_id = p.id
          )
        """
    )

    # SERVICE
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN (
            'inventory.view'
          )
        WHERE r.code = 'SERVICE'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permissions rp
              WHERE rp.role_id = r.id
                AND rp.permission_id = p.id
          )
        """
    )

    # -------------------------------------------------------------------------
    # ROLE -> PERMISSION -> SCOPE
    # -------------------------------------------------------------------------

    # ADMIN -> system.admin -> GLOBAL
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code = 'system.admin'
        JOIN auth.scopes s
          ON s.scope_type = 'GLOBAL'
         AND s.scope_code = 'GLOBAL'
        WHERE r.code = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )

    # HO -> sales/nav -> ENTITY IT01/IT02/IT03
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN (
            'sales.view',
            'sales.import',
            'sales.export',
            'nav.credentials.view',
            'nav.credentials.manage'
          )
        JOIN auth.scopes s
          ON s.scope_type = 'ENTITY'
         AND s.scope_code IN ('IT01', 'IT02', 'IT03')
        WHERE r.code = 'HO'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )

    # DM -> sales.view + inventory.view -> STORE IT207/IT208
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN ('sales.view', 'inventory.view')
        JOIN auth.scopes s
          ON s.scope_type = 'STORE'
         AND s.scope_code IN ('IT207', 'IT208')
        WHERE r.code = 'DM'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )

    # STORE -> inventory.view/edit -> STORE IT315
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code IN ('inventory.view', 'inventory.edit')
        JOIN auth.scopes s
          ON s.scope_type = 'STORE'
         AND s.scope_code = 'IT315'
        WHERE r.code = 'STORE'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )

    # SERVICE -> inventory.view -> STORE IT207/IT315
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p
          ON p.code = 'inventory.view'
        JOIN auth.scopes s
          ON s.scope_type = 'STORE'
         AND s.scope_code IN ('IT207', 'IT315')
        WHERE r.code = 'SERVICE'
          AND NOT EXISTS (
              SELECT 1
              FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id
                AND rps.permission_id = p.id
                AND rps.scope_id = s.id
          )
        """
    )


def downgrade() -> None:
    # role_permission_scopes
    op.execute(
        """
        DELETE FROM auth.role_permission_scopes
        WHERE role_id IN (
            SELECT id FROM auth.roles
            WHERE code IN ('ADMIN', 'HO', 'DM', 'STORE', 'SERVICE')
        )
        """
    )

    # role_permissions
    op.execute(
        """
        DELETE FROM auth.role_permissions
        WHERE role_id IN (
            SELECT id FROM auth.roles
            WHERE code IN ('ADMIN', 'HO', 'DM', 'STORE', 'SERVICE')
        )
        """
    )

    # demo store scopes
    op.execute(
        """
        DELETE FROM auth.scopes
        WHERE scope_type = 'STORE'
          AND scope_code IN ('IT207', 'IT208', 'IT315')
        """
    )

    # permissions
    op.execute(
        """
        DELETE FROM auth.permissions
        WHERE code IN (
            'system.admin',
            'sales.view',
            'sales.import',
            'sales.export',
            'inventory.view',
            'inventory.edit',
            'users.manage',
            'nav.credentials.view',
            'nav.credentials.manage'
        )
        """
    )

    # roles
    op.execute(
        """
        DELETE FROM auth.roles
        WHERE code IN ('ADMIN', 'HO', 'DM', 'STORE', 'SERVICE')
        """
    )