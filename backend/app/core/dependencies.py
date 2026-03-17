from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth import AdminModuleBlacklist, User, UserType
from app.models.modules import UserModulePermission, UserTypeModuleAccess
from app.models.rbac_scope import UserAssignment


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
# ASSIGNMENT LOADER
# -----------------------------------------------------------------------------
async def _load_active_assignments(db: AsyncSession, user_id) -> list[UserAssignment]:
    now = _utcnow()
    result = await db.execute(
        select(UserAssignment).where(
            UserAssignment.user_id == user_id,
            UserAssignment.is_active.is_(True),
            (UserAssignment.valid_from == None) | (UserAssignment.valid_from <= now),
            (UserAssignment.valid_to == None) | (UserAssignment.valid_to >= now),
        )
    )
    return list(result.scalars().all())


# -----------------------------------------------------------------------------
# MODULE PERMISSION CHECK
# -----------------------------------------------------------------------------
async def _is_module_blacklisted(db: AsyncSession, module_code: str) -> bool:
    result = await db.execute(
        select(AdminModuleBlacklist).where(AdminModuleBlacklist.module_code == module_code)
    )
    return result.scalar_one_or_none() is not None


async def _user_can_access_module(
    db: AsyncSession,
    user: User,
    module_code: str,
    need_manage: bool = False,
) -> bool:
    """
    Controlla se l'utente ha accesso a un modulo.
    - SUPERUSER/ADMIN: sempre sì (ADMIN bloccato da blacklist)
    - HO types (HR/FINANCE/etc), DM, STORE: verifica user_type_module_access + override utente
    """
    user_type = getattr(user, "user_type", None)

    # SUPERUSER — bypass totale
    if user_type == UserType.SUPERUSER:
        return True

    # ADMIN — bypass tranne blacklist
    if user_type == UserType.ADMIN:
        return not await _is_module_blacklisted(db, module_code)

    # Tutti gli altri: check user_type_module_access
    access_result = await db.execute(
        select(UserTypeModuleAccess).where(
            UserTypeModuleAccess.user_type == str(user_type),
            UserTypeModuleAccess.module_code == module_code,
        )
    )
    base_access = access_result.scalar_one_or_none()

    # Check override per singolo utente
    override_result = await db.execute(
        select(UserModulePermission).where(
            UserModulePermission.user_id == user.id,
            UserModulePermission.module_code == module_code,
        )
    )
    override = override_result.scalar_one_or_none()

    if need_manage:
        base = base_access.can_manage if base_access else False
        if override and override.can_manage is not None:
            return override.can_manage
        return base
    else:
        base = base_access.can_view if base_access else False
        if override and override.can_view is not None:
            return override.can_view
        return base


async def _user_can_reach_scope(
    db: AsyncSession,
    user: User,
    entity_code: str | None,
    store_code: str | None,
) -> bool:
    user_type = getattr(user, "user_type", None)

    # SUPERUSER, ADMIN e tutti i tipi HO: accesso globale
    if user_type in UserType.admin_types() | UserType.ho_types():
        return True

    assignments = await _load_active_assignments(db, user.id)
    assigned_entities = {a.entity_code for a in assignments if a.entity_code}
    assigned_stores = {a.store_code for a in assignments if a.store_code}

    if user_type == UserType.DM:
        if store_code:
            return store_code in assigned_stores or entity_code in assigned_entities
        if entity_code:
            return entity_code in assigned_entities
        return True

    if user_type == UserType.STORE:
        if store_code:
            return store_code in assigned_stores
        return False

    return False


# -----------------------------------------------------------------------------
# MAIN RBAC DEPENDENCY
# -----------------------------------------------------------------------------
def require_permission(
    module_code: str,
    *,
    need_manage: bool = False,
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
            request, entity_param_name=entity_param_name
        )
        required_store_code = fixed_store_code or _extract_store_code(
            request, store_param_name=store_param_name
        )

        # Check accesso modulo
        if not await _user_can_access_module(db, current_user, module_code, need_manage):
            raise ForbiddenError(f"Accesso al modulo '{module_code}' non consentito")

        # Check scope geografico (solo per DM e STORE)
        user_type = getattr(current_user, "user_type", None)
        if user_type not in UserType.admin_types() | UserType.ho_types():
            if not await _user_can_reach_scope(db, current_user, required_entity_code, required_store_code):
                raise ForbiddenError(f"Scope non accessibile per il modulo '{module_code}'")

        return current_user

    return dependency


# -----------------------------------------------------------------------------
# BACKWARD COMPATIBILITY
# -----------------------------------------------------------------------------
require_admin = require_permission("system.admin")
require_ho = require_permission("sales", need_manage=False)


# -----------------------------------------------------------------------------
# DEBUG HELPERS
# -----------------------------------------------------------------------------
async def get_current_user_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Restituisce i permessi modulo effettivi dell'utente corrente."""
    from sqlalchemy import select as sa_select
    from app.models.modules import Module

    modules_result = await db.execute(
        sa_select(Module).where(Module.is_active == True).order_by(Module.sort_order)
    )
    modules = modules_result.scalars().all()

    result = []
    for module in modules:
        can_view = await _user_can_access_module(db, current_user, module.code, need_manage=False)
        can_manage = await _user_can_access_module(db, current_user, module.code, need_manage=True)
        result.append({
            "module_code": module.code,
            "module_name": module.name,
            "can_view": can_view,
            "can_manage": can_manage,
        })

    return result
