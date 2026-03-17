"""add user_type and admin_module_blacklist

Revision ID: c13a10usertype01
Revises: c13a09ticketsv2
Create Date: 2026-03-17 18:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'c13a10usertype01'
down_revision: str = '709004848eaa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 — Crea l'enum user_type_enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE auth.user_type_enum AS ENUM ('SUPERUSER', 'ADMIN', 'HO', 'DM', 'STORE');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # 2 — Aggiungi colonna user_type a auth.users (nullable per la migrazione dati)
    op.add_column(
        'users',
        sa.Column(
            'user_type',
            sa.Enum('SUPERUSER', 'ADMIN', 'HO', 'DM', 'STORE',
                    name='user_type_enum', schema='auth', create_type=False),
            nullable=True,
        ),
        schema='auth',
    )

    # 3 — Popola user_type dai valori di role esistenti
    op.execute("""
        UPDATE auth.users SET user_type = CASE
            WHEN role::text = 'ADMIN' THEN 'ADMIN'::auth.user_type_enum
            WHEN role::text = 'HO'    THEN 'HO'::auth.user_type_enum
            WHEN role::text = 'DM'    THEN 'DM'::auth.user_type_enum
            WHEN role::text = 'STORE' THEN 'STORE'::auth.user_type_enum
            ELSE 'STORE'::auth.user_type_enum
        END
    """)

    # 4 — Rendi NOT NULL con default STORE
    op.alter_column('users', 'user_type', nullable=False,
                    server_default='STORE', schema='auth')

    # 5 — Indice su user_type
    op.create_index('idx_users_user_type', 'users', ['user_type'], schema='auth')

    # 6 — Crea tabella auth.admin_module_blacklist
    op.create_table(
        'admin_module_blacklist',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('module_code', sa.String(50), nullable=False, unique=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['auth.users.id'], ondelete='SET NULL'),
        schema='auth',
    )

    # 7 — Seed blacklist iniziale
    op.execute("""
        INSERT INTO auth.admin_module_blacklist (module_code, reason)
        VALUES ('licenze', 'Riservato esclusivamente a SUPERUSER')
        ON CONFLICT (module_code) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('admin_module_blacklist', schema='auth')
    op.drop_index('idx_users_user_type', table_name='users', schema='auth')
    op.drop_column('users', 'user_type', schema='auth')
    op.execute('DROP TYPE IF EXISTS auth.user_type_enum')
