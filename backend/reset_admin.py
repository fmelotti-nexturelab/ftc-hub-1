import asyncio
from app.database import AsyncSessionLocal
from app.models.auth import User
from app.core.security import get_password_hash
from sqlalchemy import select, update

async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if user:
            user.hashed_password = get_password_hash("Admin1234!")
            await db.commit()
            print(f"Password resettata per utente: {user.username} ({user.user_type})")
        else:
            print("Utente admin non trovato!")

asyncio.run(reset())
