from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    DATABASE_URL: str | None = None
    SECRET_KEY: str

    POSTGRES_DB: str | None = None
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    ANTHROPIC_API_KEY: str = ""

    # Ollama (LLM on-premise) — se configurato, usato come provider primario
    OLLAMA_BASE_URL: str = ""        # es. "http://ollama:11434"
    OLLAMA_MODEL: str = "mistral"    # modello da usare
    # Provider: "ollama" | "anthropic" | "auto" (ollama con fallback anthropic)
    AI_PROVIDER: str = "auto"

    # Path della cartella FTC HUB Storage (Stock NAV, ItemList, RetailSalesAnalysis, ecc.)
    # È sempre il percorso *interno al container*: in dev ed in prod corrisponde a
    # /mnt/f/FTC_HUB_Archivio, perché il mount Docker dei due ambienti normalizza
    # qui il disco fisico (./data in dev, D:/ in prod).
    FILE_STORAGE_PATH: str = "/mnt/f/FTC_HUB_Archivio"

    TICKET_NOTIFY_EMAIL: str = ""
    TICKET_ATTACHMENTS_PATH: str = "/data/attachments"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    ENVIRONMENT: str = "development"

    # DB read-only per AI analyst (default: stessa connessione con utente ftc_reader)
    DATABASE_READONLY_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL

        if self.POSTGRES_DB and self.POSTGRES_USER and self.POSTGRES_PASSWORD:
            return (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )

        raise ValueError(
            "Config mancante: imposta DATABASE_URL oppure "
            "POSTGRES_DB, POSTGRES_USER e POSTGRES_PASSWORD nel file .env"
        )

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    @property
    def readonly_database_url(self) -> str:
        if self.DATABASE_READONLY_URL:
            return self.DATABASE_READONLY_URL
        # Default: sostituisci user:password con ftc_reader
        base = self.database_url
        # postgresql+asyncpg://ftc_admin:changeme@db:5432/ftc_hub
        #                      ^^^^^^^^^^^^^^^^^ → ftc_reader:ftc_reader_readonly_2026
        import re
        return re.sub(
            r"://[^@]+@",
            "://ftc_reader:ftc_reader_readonly_2026@",
            base,
        )


settings = Settings()