from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Engine importato se ti serve in futuro per health più avanzati o startup hook
from app.database import engine

# Import modelli per registrazione metadata / mapper
from app.models import auth, ho, rbac_scope, modules, stores
from app.models import notification  # noqa: F401
from app.models import support  # noqa: F401
from app.models import stock  # noqa: F401
from app.models import items  # noqa: F401
from app.models import file_archive  # noqa: F401
from app.models import operator_code  # noqa: F401
from app.models import app_settings  # noqa: F401

from app.routers import auth as auth_router
from app.routers import test_rbac
from app.routers.ho import sales as sales_router
from app.routers.ho import nav_agent as nav_agent_router
from app.routers.admin import rbac as admin_rbac_router
from app.routers.admin import users as admin_users_router
from app.routers.admin import modules as admin_modules_router
from app.routers.utilities import stores as utilities_stores_router
from app.routers.utilities import access as utilities_access_router
from app.routers.utilities import check_prezzi as utilities_check_prezzi_router
from app.routers.tickets import tickets as tickets_router
from app.routers.tickets import config as tickets_config_router
from app.routers.tickets import chat as tickets_chat_router
from app.routers.admin import tickets_config as admin_tickets_config_router
from app.routers import notifications as notifications_router
from app.routers.admin import support as admin_support_router
from app.routers.admin import diagnostics as admin_diagnostics_router
from app.routers.admin import ticket_performance as admin_ticket_performance_router
from app.routers import stock as stock_router
from app.routers import archive as archive_router
from app.routers.items import it01 as items_it01_router
from app.routers.items import it02 as items_it02_router
from app.routers.items import promo as items_promo_router
from app.routers.items import blackfriday as items_bf_router
from app.routers.items import bestseller as items_bestseller_router
from app.routers import operator_code as operator_code_router
from app.routers import app_settings as app_settings_router


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
app.include_router(nav_agent_router.router)
app.include_router(test_rbac.router)
app.include_router(admin_rbac_router.router)
app.include_router(admin_users_router.router)
app.include_router(admin_modules_router.router)
app.include_router(utilities_access_router.router)
app.include_router(utilities_stores_router.router)
app.include_router(utilities_check_prezzi_router.router)
app.include_router(tickets_config_router.router)
app.include_router(tickets_chat_router.router)
app.include_router(tickets_router.router)
app.include_router(admin_tickets_config_router.router)
app.include_router(notifications_router.router)
app.include_router(admin_support_router.router)
app.include_router(admin_diagnostics_router.router)
app.include_router(admin_ticket_performance_router.router)
app.include_router(stock_router.router)
app.include_router(archive_router.router)
app.include_router(items_it01_router.router)
app.include_router(items_it02_router.router)
app.include_router(items_promo_router.router)
app.include_router(items_bf_router.router)
app.include_router(items_bestseller_router.router)
app.include_router(operator_code_router.router)
app.include_router(app_settings_router.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "FTC HUB",
    }