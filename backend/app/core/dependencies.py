from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.security import decode_access_token
from app.models.auth import (
    User,
    UserRole,
    Role,
    Permission,
    UserRoleAssignment,
    RolePermission,
)

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
        )

    user_id = payload.get("sub")
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utente non trovato",
        )

    return user


def require_role(*roles: UserRole):
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accesso richiede ruolo: {', '.join(r.value for r in roles)}",
            )
        return current_user

    return checker


require_admin = require_role(UserRole.ADMIN)
require_ho = require_role(UserRole.ADMIN, UserRole.HO)
require_dm = require_role(UserRole.ADMIN, UserRole.DM)
require_store = require_role(UserRole.ADMIN, UserRole.STORE)


async def get_user_permissions(
    user_id,
    db: AsyncSession,
) -> set[str]:
    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(UserRoleAssignment.user_id == user_id)
        .where(Role.is_active == True)
        .where(Permission.is_active == True)
    )

    return set(result.scalars().all())


def require_permission(permission_code: str):
    async def checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        permissions = await get_user_permissions(current_user.id, db)

        if "system.admin" in permissions:
            return current_user

        if permission_code not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permesso mancante: {permission_code}",
            )

        return current_user

    return checker