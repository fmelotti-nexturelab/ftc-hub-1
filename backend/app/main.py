from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Engine importato se ti serve in futuro per health più avanzati o startup hook
from app.database import engine

# Import modelli per registrazione metadata / mapper
from app.models import auth, ho, rbac_scope, modules

from app.routers import auth as auth_router
from app.routers import test_rbac
from app.routers.ho import sales as sales_router
from app.routers.admin import rbac as admin_rbac_router
from app.routers.admin import users as admin_users_router
from app.routers.admin import modules as admin_modules_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    IMPORTANT:
    Non usare Base.metadata.create_all() in produzione o in ambienti
    dove lo schema viene gestito da Alembic.

    Le tabelle devono essere create e versionate SOLO tramite migration.
    """
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
        "http://127.0.0.1:3000",
        "https://localhost",
        "https://127.0.0.1",
        "https://HO-SERVICES",
        "https://10.74.0.110",
        "https://hub.nexturelab.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ROUTERS
app.include_router(auth_router.router)
app.include_router(sales_router.router)
app.include_router(test_rbac.router)
app.include_router(admin_rbac_router.router)
app.include_router(admin_users_router.router)
app.include_router(admin_modules_router.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "FTC HUB",
    }