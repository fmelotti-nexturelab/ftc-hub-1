import uuid
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import (
    get_current_user,
    require_permission,
    _load_active_assignments,
)
from app.core.security import get_password_hash
from app.models.auth import (
    AdminModuleBlacklist,
    Permission,
    Role,
    User,
    UserRole,
    UserRoleAssignment,
    UserDepartment,
)
from app.models.rbac_scope import UserAssignment

router = APIRouter(prefix="/api/admin/users", tags=["Admin - Users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    department: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    roles: list[dict] = []
    assignments: list[dict] = []


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    department: UserDepartment = UserDepartment.STORE


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class ChangeDepartmentRequest(BaseModel):
    department: UserDepartment


class AddAssignmentRequest(BaseModel):
    entity_code: Optional[str] = None
    store_code: Optional[str] = None
    assignment_type: str = "PRIMARY"
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    notes: Optional[str] = None


class BlacklistResponse(BaseModel):
    id: uuid.UUID
    module_code: str
    reason: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AddBlacklistRequest(BaseModel):
    module_code: str
    reason: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_superuser(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "department", None) != UserDepartment.SUPERUSER:
        raise HTTPException(403, "Solo SUPERUSER può eseguire questa operazione")
    return current_user


def _require_admin_or_above(current_user: User = Depends(get_current_user)) -> User:
    department = getattr(current_user, "department", None)
    if department not in (UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT):
        raise HTTPException(403, "Accesso riservato ad ADMIN, SUPERUSER o IT")
    return current_user


# ── CRUD Utenti ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserResponse])
async def list_users(
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin_or_above),
):
    stmt = select(User)
    if department:
        stmt = stmt.where(User.department == department)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    stmt = stmt.order_by(User.username)
    result = await db.execute(stmt)
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin_or_above),
):
    # Solo SUPERUSER può creare SUPERUSER o ADMIN
    if data.department in (UserDepartment.SUPERUSER, UserDepartment.ADMIN):
        if getattr(current_user, "department", None) != UserDepartment.SUPERUSER:
            raise HTTPException(403, "Solo SUPERUSER può creare utenti SUPERUSER o ADMIN")

    # Verifica username univoco
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Username '{data.username}' già in uso")

    # Mappa department → role legacy
    role_map = {
        UserDepartment.SUPERUSER: UserRole.ADMIN,
        UserDepartment.ADMIN: UserRole.ADMIN,
        UserDepartment.HR: UserRole.HO,
        UserDepartment.FINANCE: UserRole.HO,
        UserDepartment.MARKETING: UserRole.HO,
        UserDepartment.IT: UserRole.ADMIN,
        UserDepartment.COMMERCIAL: UserRole.HO,
        UserDepartment.DM: UserRole.DM,
        UserDepartment.STORE: UserRole.STORE,
        UserDepartment.STOREMANAGER: UserRole.STORE,
        UserDepartment.RETAIL: UserRole.HO,
        UserDepartment.MANAGER: UserRole.HO,
        UserDepartment.TOPMGR: UserRole.HO,
        UserDepartment.HEALTHSAFETY: UserRole.HO,
        UserDepartment.FACILITIES: UserRole.HO,
    }

    user = User(
        id=uuid.uuid4(),
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=role_map[data.department],
        department=data.department,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin_or_above),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utente non trovato")

    # Ruoli assegnati
    roles_result = await db.execute(
        select(Role.code, Role.name)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(UserRoleAssignment.user_id == user_id)
    )
    roles = [{"code": r.code, "name": r.name} for r in roles_result.all()]

    # Assignments attivi
    assignments = await _load_active_assignments(db, user_id)
    assignments_out = [
        {
            "id": str(a.id),
            "entity_code": a.entity_code,
            "store_code": a.store_code,
            "assignment_type": a.assignment_type,
            "valid_to": a.valid_to.isoformat() if a.valid_to else None,
        }
        for a in assignments
    ]

    out = UserDetailResponse.model_validate(user)
    out.roles = roles
    out.assignments = assignments_out
    return out


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin_or_above),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utente non trovato")

    if data.email is not None:
        user.email = data.email
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.hashed_password = get_password_hash(data.password)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin_or_above),
):
    if user_id == current_user.id:
        raise HTTPException(400, "Non puoi disattivare te stesso")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utente non trovato")

    try:
        await db.delete(user)
        await db.commit()
        return {"message": "Utente eliminato", "deleted": True}
    except Exception:
        await db.rollback()
        # FK violation: l'utente ha dati collegati, lo disattiviamo
        user.is_active = False
        await db.commit()
        return {"message": "Utente disattivato (ha dati collegati, impossibile eliminare)", "deleted": False}


# ── Cambio department (solo SUPERUSER) ────────────────────────────────────────

@router.patch("/{user_id}/department")
async def change_department(
    user_id: uuid.UUID,
    data: ChangeDepartmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin_or_above),
):
    # Solo SUPERUSER può promuovere altri a SUPERUSER
    if data.department == UserDepartment.SUPERUSER:
        if getattr(current_user, "department", None) != UserDepartment.SUPERUSER:
            raise HTTPException(403, "Solo SUPERUSER può assegnare il tipo SUPERUSER")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utente non trovato")

    old_dept = user.department
    user.department = data.department

    # Se promosso a HO/ADMIN/SUPERUSER, rimuovi assignments (non servono)
    if data.department in (UserDepartment.ADMIN, UserDepartment.SUPERUSER):
        assignments_result = await db.execute(
            select(UserAssignment).where(
                UserAssignment.user_id == user_id,
                UserAssignment.is_active == True,
            )
        )
        for a in assignments_result.scalars().all():
            a.is_active = False

    await db.commit()
    return {"message": f"department cambiato da {old_dept} a {data.department}"}


# ── Effective permissions (debug/audit) ───────────────────────────────────────

@router.get("/{user_id}/effective-permissions")
async def effective_permissions(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin_or_above),
):
    from app.core.dependencies import _user_can_access_module
    from app.models.modules import Module

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utente non trovato")

    department = getattr(user, "department", None)
    assignments = await _load_active_assignments(db, user_id)
    assigned_entities = [a.entity_code for a in assignments if a.entity_code]
    assigned_stores = [a.store_code for a in assignments if a.store_code]

    modules_result = await db.execute(
        select(Module).where(Module.is_active == True).order_by(Module.sort_order)
    )
    modules = modules_result.scalars().all()

    permissions_out = []
    for module in modules:
        can_view = await _user_can_access_module(db, user, module.code, need_manage=False)
        can_manage = await _user_can_access_module(db, user, module.code, need_manage=True)
        permissions_out.append({
            "module_code": module.code,
            "module_name": module.name,
            "can_view": can_view,
            "can_manage": can_manage,
        })

    return {
        "user_id": str(user_id),
        "username": user.username,
        "department": str(department),
        "scope_ceiling": {
            "entities": assigned_entities,
            "stores": assigned_stores,
        },
        "module_permissions": permissions_out,
    }


# ── Admin module blacklist ─────────────────────────────────────────────────────

@router.get("/blacklist/modules", response_model=list[BlacklistResponse])
async def list_blacklist(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_superuser),
):
    result = await db.execute(
        select(AdminModuleBlacklist).order_by(AdminModuleBlacklist.module_code)
    )
    return [BlacklistResponse.model_validate(b) for b in result.scalars().all()]


@router.post("/blacklist/modules", response_model=BlacklistResponse, status_code=201)
async def add_blacklist(
    data: AddBlacklistRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_superuser),
):
    existing = await db.execute(
        select(AdminModuleBlacklist).where(
            AdminModuleBlacklist.module_code == data.module_code
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Modulo '{data.module_code}' già in blacklist")

    entry = AdminModuleBlacklist(
        module_code=data.module_code.lower(),
        reason=data.reason,
        created_by=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return BlacklistResponse.model_validate(entry)


@router.delete("/blacklist/modules/{module_code}")
async def remove_blacklist(
    module_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_superuser),
):
    result = await db.execute(
        select(AdminModuleBlacklist).where(
            AdminModuleBlacklist.module_code == module_code.lower()
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Modulo non trovato in blacklist")
    await db.delete(entry)
    await db.commit()
    return {"message": f"Modulo '{module_code}' rimosso dalla blacklist"}
