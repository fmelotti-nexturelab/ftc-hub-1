from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.models import auth, ho

from app.routers import auth as auth_router
from app.routers.ho import sales as sales_router
from app.routers import test_rbac   # ← nuovo router RBAC test


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="FTC HUB API",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ROUTERS
app.include_router(auth_router.router)
app.include_router(sales_router.router)

# router per test RBAC
app.include_router(test_rbac.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "FTC HUB"
    }