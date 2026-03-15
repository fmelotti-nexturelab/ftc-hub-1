from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth import Permission, Role, RolePermission, User, UserRole, UserRoleAssignment
from app.models.rbac_scope import RolePermissionScope, Scope, UserPermissionScope


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class AuthError(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Not enough permissions") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


@dataclass
class ResolvedPermission:
    permission_code: str
    scope_type: str
    scope_code: str
    entity_code: str | None
    store_code: str | None
    effect: str = "allow"


# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _is_valid_now(valid_from: datetime | None, valid_to: datetime | None) -> bool:
    now = _utcnow()
    valid_from = _normalize_dt(valid_from)
    valid_to = _normalize_dt(valid_to)

    if valid_from and now < valid_from:
        return False
    if valid_to and now > valid_to:
        return False
    return True


def _extract_entity_code(request: Request, entity_param_name: str = "entity_code") -> str | None:
    return (
        request.path_params.get(entity_param_name)
        or request.query_params.get(entity_param_name)
        or request.headers.get("X-Entity-Code")
    )


def _extract_store_code(request: Request, store_param_name: str = "store_code") -> str | None:
    return (
        request.path_params.get(store_param_name)
        or request.query_params.get(store_param_name)
        or request.headers.get("X-Store-Code")
    )


def _scope_matches(
    required_entity_code: str | None,
    required_store_code: str | None,
    granted: ResolvedPermission,
) -> bool:
    if granted.scope_type == "GLOBAL":
        return True

    if granted.scope_type == "ENTITY":
        return required_entity_code is not None and granted.entity_code == required_entity_code

    if granted.scope_type == "STORE":
        return required_store_code is not None and granted.store_code == required_store_code

    if granted.scope_type == "MODULE":
        return required_entity_code is None and required_store_code is None

    return False


# -----------------------------------------------------------------------------
# JWT / CURRENT USER
# -----------------------------------------------------------------------------
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = AuthError()

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        subject: str | None = payload.get("sub")
        if not subject:
            raise credentials_exception
        user_id = uuid.UUID(subject)
    except (JWTError, ValueError, AttributeError) as exc:
        raise credentials_exception from exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


# -----------------------------------------------------------------------------
# PERMISSION LOADERS
# -----------------------------------------------------------------------------
async def _load_role_permissions(
    db: AsyncSession,
    user_id,
) -> list[ResolvedPermission]:
    stmt = (
        select(
            Permission.code.label("permission_code"),
            Scope.scope_type.label("scope_type"),
            Scope.scope_code.label("scope_code"),
            Scope.entity_code.label("entity_code"),
            Scope.store_code.label("store_code"),
        )
        .select_from(UserRoleAssignment)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .join(
            RolePermissionScope,
            and_(
                RolePermissionScope.role_id == Role.id,
                RolePermissionScope.permission_id == Permission.id,
                RolePermissionScope.is_active.is_(True),
            ),
        )
        .join(
            Scope,
            and_(
                Scope.id == RolePermissionScope.scope_id,
                Scope.is_active.is_(True),
            ),
        )
        .where(UserRoleAssignment.user_id == user_id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        ResolvedPermission(
            permission_code=row.permission_code,
            scope_type=row.scope_type,
            scope_code=row.scope_code,
            entity_code=row.entity_code,
            store_code=row.store_code,
            effect="allow",
        )
        for row in rows
    ]


async def _load_user_permission_overrides(
    db: AsyncSession,
    user_id,
) -> list[ResolvedPermission]:
    stmt = (
        select(
            Permission.code.label("permission_code"),
            Scope.scope_type.label("scope_type"),
            Scope.scope_code.label("scope_code"),
            Scope.entity_code.label("entity_code"),
            Scope.store_code.label("store_code"),
            UserPermissionScope.effect.label("effect"),
            UserPermissionScope.valid_from.label("valid_from"),
            UserPermissionScope.valid_to.label("valid_to"),
        )
        .select_from(UserPermissionScope)
        .join(Permission, Permission.id == UserPermissionScope.permission_id)
        .join(
            Scope,
            and_(
                Scope.id == UserPermissionScope.scope_id,
                Scope.is_active.is_(True),
            ),
        )
        .where(
            UserPermissionScope.user_id == user_id,
            UserPermissionScope.is_active.is_(True),
        )
    )

    result = await db.execute(stmt)
    rows = result.all()

    resolved: list[ResolvedPermission] = []

    for row in rows:
        if not _is_valid_now(row.valid_from, row.valid_to):
            continue

        resolved.append(
            ResolvedPermission(
                permission_code=row.permission_code,
                scope_type=row.scope_type,
                scope_code=row.scope_code,
                entity_code=row.entity_code,
                store_code=row.store_code,
                effect=row.effect,
            )
        )

    return resolved


async def _resolve_all_permissions(
    db: AsyncSession,
    user: User,
) -> list[ResolvedPermission]:
    role_permissions = await _load_role_permissions(db=db, user_id=user.id)
    user_overrides = await _load_user_permission_overrides(db=db, user_id=user.id)
    return [*role_permissions, *user_overrides]


def _has_admin_bypass(resolved_permissions: list[ResolvedPermission]) -> bool:
    for item in resolved_permissions:
        if (
            item.effect == "allow"
            and item.permission_code == "system.admin"
            and item.scope_type == "GLOBAL"
        ):
            return True
    return False


def _has_explicit_deny(
    resolved_permissions: list[ResolvedPermission],
    permission_code: str,
    entity_code: str | None,
    store_code: str | None,
) -> bool:
    for item in resolved_permissions:
        if item.effect != "deny":
            continue
        if item.permission_code != permission_code:
            continue
        if _scope_matches(entity_code, store_code, item):
            return True
    return False


def _has_explicit_allow(
    resolved_permissions: list[ResolvedPermission],
    permission_code: str,
    entity_code: str | None,
    store_code: str | None,
) -> bool:
    for item in resolved_permissions:
        if item.effect != "allow":
            continue
        if item.permission_code != permission_code:
            continue
        if _scope_matches(entity_code, store_code, item):
            return True
    return False


# -----------------------------------------------------------------------------
# MAIN RBAC DEPENDENCY
# -----------------------------------------------------------------------------
def require_permission(
    permission_code: str,
    *,
    entity_param_name: str = "entity_code",
    store_param_name: str = "store_code",
    fixed_entity_code: str | None = None,
    fixed_store_code: str | None = None,
) -> Callable:
    async def dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        required_entity_code = fixed_entity_code or _extract_entity_code(
            request,
            entity_param_name=entity_param_name,
        )
        required_store_code = fixed_store_code or _extract_store_code(
            request,
            store_param_name=store_param_name,
        )

        resolved_permissions = await _resolve_all_permissions(db=db, user=current_user)

        if _has_admin_bypass(resolved_permissions):
            return current_user

        if _has_explicit_deny(
            resolved_permissions=resolved_permissions,
            permission_code=permission_code,
            entity_code=required_entity_code,
            store_code=required_store_code,
        ):
            raise ForbiddenError(f"Permission denied: {permission_code}")

        if _has_explicit_allow(
            resolved_permissions=resolved_permissions,
            permission_code=permission_code,
            entity_code=required_entity_code,
            store_code=required_store_code,
        ):
            return current_user

        raise ForbiddenError(f"Missing permission: {permission_code}")

    return dependency


# -----------------------------------------------------------------------------
# BACKWARD COMPATIBILITY
# -----------------------------------------------------------------------------
def require_admin() -> Callable:
    """
    Compatibilità con il codice esistente che usa require_admin.
    """
    return require_permission("system.admin")


def require_ho() -> Callable:
    """
    Compatibilità con il codice esistente HO.
    Per ora viene mappato sul permesso sales.view, che è coerente
    con il modulo HO Sales già presente nel progetto.
    """
    return require_permission("sales.view")


# -----------------------------------------------------------------------------
# DEBUG / TEST HELPERS
# -----------------------------------------------------------------------------
async def get_current_user_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    resolved = await _resolve_all_permissions(db=db, user=current_user)

    return [
        {
            "permission_code": item.permission_code,
            "scope_type": item.scope_type,
            "scope_code": item.scope_code,
            "entity_code": item.entity_code,
            "store_code": item.store_code,
            "effect": item.effect,
        }
        for item in resolved
    ]