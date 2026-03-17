import asyncio
from app.database import AsyncSessionLocal
from app.models.auth import User, UserType
from app.core.security import get_password_hash
from sqlalchemy import select

async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if user:
            user.hashed_password = get_password_hash("Admin@2024!")
            user.user_type = UserType.SUPERUSER
            await db.commit()
            print(f"Utente: {user.username} | Tipo: {user.user_type} | Password resettata a Admin@2024!")
        else:
            print("Utente admin non trovato!")

asyncio.run(reset())
