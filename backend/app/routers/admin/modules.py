import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.auth import User, UserDepartment
from app.models.modules import Module, UserModulePermission, DepartmentModuleAccess

router = APIRouter(prefix="/api/admin/modules", tags=["Admin - Modules"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModuleResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    has_view: bool
    has_manage: bool
    is_active: bool
    sort_order: int
    model_config = {"from_attributes": True}


class DepartmentAccessResponse(BaseModel):
    department: str
    module_code: str
    can_view: bool
    can_manage: bool
    model_config = {"from_attributes": True}


class UpdateDepartmentAccessRequest(BaseModel):
    can_view: bool
    can_manage: bool


class UserModulePermissionResponse(BaseModel):
    module_code: str
    can_view: Optional[bool] = None
    can_manage: Optional[bool] = None
    model_config = {"from_attributes": True}


class UpdateUserModulePermissionRequest(BaseModel):
    can_view: Optional[bool] = None
    can_manage: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    department = getattr(current_user, "department", None)
    if department not in (UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT):
        raise HTTPException(403, "Accesso riservato ad ADMIN, SUPERUSER o IT")
    return current_user


# ── Moduli ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ModuleResponse])
async def list_modules(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(
        select(Module).where(Module.is_active == True).order_by(Module.sort_order)
    )
    return [ModuleResponse.model_validate(m) for m in result.scalars().all()]


# ── Accessi per department ────────────────────────────────────────────────────

@router.get("/access", response_model=list[DepartmentAccessResponse])
async def get_all_access(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(select(DepartmentModuleAccess))
    return [DepartmentAccessResponse.model_validate(a) for a in result.scalars().all()]


@router.put("/access/{department}/{module_code}", response_model=DepartmentAccessResponse)
async def update_department_access(
    department: str,
    module_code: str,
    data: UpdateDepartmentAccessRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    # Valida department
    valid_types = [t.value for t in UserDepartment if t not in (UserDepartment.SUPERUSER, UserDepartment.ADMIN)]
    if department not in valid_types:
        raise HTTPException(400, f"department non valido: {department}")

    result = await db.execute(
        select(DepartmentModuleAccess).where(
            DepartmentModuleAccess.department == department,
            DepartmentModuleAccess.module_code == module_code,
        )
    )
    access = result.scalar_one_or_none()

    if access:
        access.can_view = data.can_view
        access.can_manage = data.can_manage
    else:
        access = DepartmentModuleAccess(
            department=department,
            module_code=module_code,
            can_view=data.can_view,
            can_manage=data.can_manage,
        )
        db.add(access)

    await db.commit()
    await db.refresh(access)
    return DepartmentAccessResponse.model_validate(access)


# ── Override per singolo utente ───────────────────────────────────────────────

@router.get("/users/{user_id}/permissions", response_model=list[UserModulePermissionResponse])
async def get_user_module_permissions(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(
        select(UserModulePermission).where(UserModulePermission.user_id == user_id)
    )
    return [UserModulePermissionResponse.model_validate(p) for p in result.scalars().all()]


@router.put("/users/{user_id}/permissions/{module_code}", response_model=UserModulePermissionResponse)
async def set_user_module_permission(
    user_id: uuid.UUID,
    module_code: str,
    data: UpdateUserModulePermissionRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(
        select(UserModulePermission).where(
            UserModulePermission.user_id == user_id,
            UserModulePermission.module_code == module_code,
        )
    )
    perm = result.scalar_one_or_none()

    if perm:
        perm.can_view = data.can_view
        perm.can_manage = data.can_manage
    else:
        perm = UserModulePermission(
            user_id=user_id,
            module_code=module_code,
            can_view=data.can_view,
            can_manage=data.can_manage,
        )
        db.add(perm)

    await db.commit()
    await db.refresh(perm)
    return UserModulePermissionResponse.model_validate(perm)


@router.delete("/users/{user_id}/permissions/{module_code}")
async def delete_user_module_permission(
    user_id: uuid.UUID,
    module_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(
        select(UserModulePermission).where(
            UserModulePermission.user_id == user_id,
            UserModulePermission.module_code == module_code,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(404, "Override non trovato")
    await db.delete(perm)
    await db.commit()
    return {"message": "Override rimosso, torna ai default del department"}
