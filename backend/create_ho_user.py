import asyncio
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.auth import User, UserRole
from app.core.security import get_password_hash


async def main():

    async with AsyncSessionLocal() as db:

        username = "ho_user"

        result = await db.execute(
            select(User).where(User.username == username)
        )

        existing = result.scalar_one_or_none()

        if existing:
            print("utente già esistente")
            return

        user = User(
            id=uuid.uuid4(),
            username="ho_user",
            email="ho@ftchub.local",
            hashed_password=get_password_hash("HoUser@2024!"),
            full_name="HO User",
            role=UserRole.HO,
            is_active=True,
        )

        db.add(user)
        await db.commit()

        print("utente HO creato")
        print("username: ho_user")
        print("password: HoUser@2024!")


asyncio.run(main())