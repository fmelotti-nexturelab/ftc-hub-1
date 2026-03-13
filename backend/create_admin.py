import asyncio
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.auth import User, Role, UserRoleAssignment, UserRole
from app.core.security import get_password_hash


ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@ftchub.local"
ADMIN_PASSWORD = "Admin@2024!"


async def main():

    async with AsyncSessionLocal() as session:

        # verifica se esiste già
        result = await session.execute(
            select(User).where(User.username == ADMIN_USERNAME)
        )

        existing_user = result.scalar_one_or_none()

        if existing_user:
            print("Admin già esistente")
            return

        # recupera il ruolo ADMIN
        result = await session.execute(
            select(Role).where(Role.code == "ADMIN")
        )

        role = result.scalar_one()

        # crea utente admin
        user = User(
            id=uuid.uuid4(),
            username="admin",
            email="admin@ftchub.local",
            hashed_password=get_password_hash("Admin@2024!"),
            full_name="Amministratore",
            role=UserRole.ADMIN,
            is_active=True
        )

        session.add(user)
        await session.flush()

        # assegna il ruolo tramite RBAC
        assignment = UserRoleAssignment(
            id=uuid.uuid4(),
            user_id=user.id,
            role_id=role.id
        )

        session.add(assignment)

        await session.commit()

        print("Admin creato con successo")
        print("username: admin")
        print("password: Admin@2024!")


if __name__ == "__main__":
    asyncio.run(main())