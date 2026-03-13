import asyncio
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.auth import User, Role, UserRoleAssignment, UserRole
from app.core.security import get_password_hash


async def main():
    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        user = result.scalar_one_or_none()

        if not user:
            print("Utente admin non trovato")
            return

        # aggiorna i dati dell'utente admin
        user.email = "admin@ftchub.local"
        user.hashed_password = get_password_hash("Admin@2024!")
        user.full_name = "Amministratore"
        user.role = UserRole.ADMIN
        user.is_active = True

        # recupera il ruolo ADMIN nel sistema RBAC
        result = await session.execute(
            select(Role).where(Role.code == "ADMIN")
        )
        role = result.scalar_one_or_none()

        if not role:
            print("Ruolo ADMIN non trovato. Esegui prima create_auth_seed.py")
            return

        # verifica se l'assegnazione esiste già
        result = await session.execute(
            select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == user.id,
                UserRoleAssignment.role_id == role.id
            )
        )
        assignment = result.scalar_one_or_none()

        if not assignment:
            session.add(
                UserRoleAssignment(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    role_id=role.id
                )
            )

        await session.commit()

        print("Admin aggiornato con successo")
        print("username: admin")
        print("password: Admin@2024!")


if __name__ == "__main__":
    asyncio.run(main())