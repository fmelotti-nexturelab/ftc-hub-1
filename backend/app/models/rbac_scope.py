from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Scope(Base):
    __tablename__ = "scopes"
    __table_args__ = (
        CheckConstraint(
            "scope_type in ('GLOBAL', 'ENTITY', 'STORE', 'MODULE')",
            name="ck_scopes_type",
        ),
        UniqueConstraint("scope_type", "scope_code", name="uq_scopes_type_code"),
        Index("ix_scopes_type", "scope_type"),
        Index("ix_scopes_entity_code", "entity_code"),
        Index("ix_scopes_store_code", "store_code"),
        {"schema": "auth"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    scope_code: Mapped[str] = mapped_column(String(100), nullable=False)

    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    entity_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    store_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    module_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    role_permission_scopes: Mapped[list["RolePermissionScope"]] = relationship(
        "RolePermissionScope",
        back_populates="scope",
        cascade="all, delete-orphan",
    )

    user_permission_scopes: Mapped[list["UserPermissionScope"]] = relationship(
        "UserPermissionScope",
        back_populates="scope",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Scope(id={self.id}, type={self.scope_type}, code={self.scope_code})>"


class RolePermissionScope(Base):
    __tablename__ = "role_permission_scopes"
    __table_args__ = (
        UniqueConstraint(
            "role_id",
            "permission_id",
            "scope_id",
            name="uq_role_permission_scope",
        ),
        Index("ix_rps_role", "role_id"),
        Index("ix_rps_permission", "permission_id"),
        Index("ix_rps_scope", "scope_id"),
        {"schema": "auth"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.roles.id", ondelete="CASCADE"),
        nullable=False,
    )

    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.permissions.id", ondelete="CASCADE"),
        nullable=False,
    )

    scope_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.scopes.id", ondelete="CASCADE"),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    scope: Mapped["Scope"] = relationship("Scope", back_populates="role_permission_scopes")

    def __repr__(self) -> str:
        return (
            f"<RolePermissionScope(id={self.id}, role_id={self.role_id}, "
            f"permission_id={self.permission_id}, scope_id={self.scope_id})>"
        )


class UserPermissionScope(Base):
    __tablename__ = "user_permission_scopes"
    __table_args__ = (
        CheckConstraint(
            "effect in ('allow', 'deny')",
            name="ck_user_permission_scopes_effect",
        ),
        Index("ix_ups_user", "user_id"),
        Index("ix_ups_permission", "permission_id"),
        Index("ix_ups_scope", "scope_id"),
        Index("ix_ups_validity", "valid_from", "valid_to"),
        {"schema": "auth"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
    )

    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.permissions.id", ondelete="CASCADE"),
        nullable=False,
    )

    scope_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.scopes.id", ondelete="CASCADE"),
        nullable=False,
    )

    effect: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="allow",
        server_default="allow",
    )

    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id"),
        nullable=True,
    )

    scope: Mapped["Scope"] = relationship("Scope", back_populates="user_permission_scopes")

    def __repr__(self) -> str:
        return (
            f"<UserPermissionScope(id={self.id}, user_id={self.user_id}, "
            f"permission_id={self.permission_id}, scope_id={self.scope_id}, effect={self.effect})>"
        )


class UserAssignment(Base):
    __tablename__ = "user_assignments"
    __table_args__ = (
        CheckConstraint(
            "assignment_type in ('PRIMARY', 'SECONDARY', 'TEMP')",
            name="ck_user_assignments_type",
        ),
        CheckConstraint(
            "entity_code is not null or store_code is not null",
            name="ck_user_assignments_entity_or_store",
        ),
        Index("ix_assignments_user", "user_id"),
        Index("ix_assignments_entity", "entity_code"),
        Index("ix_assignments_store", "store_code"),
        {"schema": "auth"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
    )

    entity_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    store_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    assignment_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PRIMARY",
        server_default="PRIMARY",
    )

    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<UserAssignment(id={self.id}, user_id={self.user_id}, "
            f"entity_code={self.entity_code}, store_code={self.store_code}, "
            f"type={self.assignment_type})>"
        )