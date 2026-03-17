"""initial baseline

Revision ID: e33bda35e355
Revises: 
Create Date: 2026-03-12 22:10:41.935414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


# revision identifiers, used by Alembic.
revision: str = 'e33bda35e355'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create userrole enum
    op.execute("CREATE TYPE auth.userrole AS ENUM ('ADMIN', 'HO', 'DM', 'STORE')")

    # Create auth.users
    op.create_table(
        'users',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100)),
        sa.Column('role', sa.Enum('ADMIN', 'HO', 'DM', 'STORE', name='userrole', schema='auth'), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('last_login', sa.DateTime(timezone=True)),
        schema='auth',
    )
    op.create_index('ix_auth_users_username', 'users', ['username'], schema='auth')
    op.create_index('ix_auth_users_email', 'users', ['email'], schema='auth')

    # Create auth.refresh_tokens (FK without CASCADE — b69996e08f2f will add it)
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(255), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('revoked', sa.Boolean(), default=False),
        sa.ForeignKeyConstraint(['user_id'], ['auth.users.id'], name='refresh_tokens_user_id_fkey'),
        schema='auth',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('refresh_tokens', schema='auth')
    op.drop_index('ix_auth_users_email', table_name='users', schema='auth')
    op.drop_index('ix_auth_users_username', table_name='users', schema='auth')
    op.drop_table('users', schema='auth')
    op.execute("DROP TYPE auth.userrole")
