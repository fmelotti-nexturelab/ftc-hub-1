from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey,
    Index, Integer, Numeric, String, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ItemImportSession(Base):
    __tablename__ = "item_import_sessions"
    __table_args__ = (
        Index("ix_item_import_sessions_entity_current", "entity", "is_current"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity = Column(String(10), nullable=False)
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    imported_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(String(8), nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    source_filename = Column(String(255), nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)

    items = relationship("ItemMasterIT01", back_populates="session", cascade="all, delete-orphan")
    importer = relationship("User", foreign_keys=[imported_by])


class ItemMasterIT01(Base):
    __tablename__ = "item_master_it01"
    __table_args__ = (
        Index("ix_item_master_it01_session", "session_id"),
        Index("ix_item_master_it01_item_no", "item_no"),
        Index("ix_item_master_it01_barcode", "barcode"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("ho.item_import_sessions.id", ondelete="CASCADE"), nullable=False)
    item_no = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False, default="")
    description_local = Column(String(500), nullable=False, default="")
    warehouse = Column(String(50), nullable=True)
    last_cost = Column(Numeric(12, 4), nullable=True)
    unit_price = Column(Numeric(12, 4), nullable=True)
    item_cat = Column(String(100), nullable=True)
    net_weight = Column(Numeric(10, 4), nullable=True)
    barcode = Column(BigInteger, nullable=True)
    vat_code = Column(String(50), nullable=True)
    units_per_pack = Column(Integer, nullable=True)
    model_store = Column(String(100), nullable=True)
    batteries = Column(String(100), nullable=True)
    first_rp = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    barcode_ext = Column(BigInteger, nullable=True)
    vat_pct = Column(Numeric(8, 4), nullable=True)
    gm_pct = Column(Numeric(8, 4), nullable=True)
    description1 = Column(String(500), nullable=True)
    description2 = Column(String(500), nullable=True)
    modulo = Column(String(100), nullable=True)
    model_store_portale = Column(String(100), nullable=True)
    modulo_numerico = Column(Numeric(12, 4), nullable=True)
    model_store_portale_num = Column(Numeric(12, 4), nullable=True)

    session = relationship("ItemImportSession", back_populates="items")


class ItemPromo(Base):
    """Articoli ItemPromo — stesse colonne di ItemMasterIT01."""
    __tablename__ = "item_promo"
    __table_args__ = (
        Index("ix_item_promo_item_no", "item_no"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False, default="")
    description_local = Column(String(500), nullable=False, default="")
    warehouse = Column(String(50), nullable=True)
    last_cost = Column(Numeric(12, 4), nullable=True)
    unit_price = Column(Numeric(12, 4), nullable=True)
    item_cat = Column(String(100), nullable=True)
    net_weight = Column(Numeric(10, 4), nullable=True)
    barcode = Column(BigInteger, nullable=True)
    vat_code = Column(String(50), nullable=True)
    units_per_pack = Column(Integer, nullable=True)
    model_store = Column(String(100), nullable=True)
    batteries = Column(String(100), nullable=True)
    first_rp = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    barcode_ext = Column(BigInteger, nullable=True)
    vat_pct = Column(Numeric(8, 4), nullable=True)
    gm_pct = Column(Numeric(8, 4), nullable=True)
    description1 = Column(String(500), nullable=True)
    description2 = Column(String(500), nullable=True)
    modulo = Column(String(100), nullable=True)
    model_store_portale = Column(String(100), nullable=True)
    modulo_numerico = Column(Numeric(12, 4), nullable=True)
    model_store_portale_num = Column(Numeric(12, 4), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ItemBlackFriday(Base):
    """Articoli Item BlackFriday — stesse colonne di ItemMasterIT01."""
    __tablename__ = "item_blackfriday"
    __table_args__ = (
        Index("ix_item_blackfriday_item_no", "item_no"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False, default="")
    description_local = Column(String(500), nullable=False, default="")
    warehouse = Column(String(50), nullable=True)
    last_cost = Column(Numeric(12, 4), nullable=True)
    unit_price = Column(Numeric(12, 4), nullable=True)
    item_cat = Column(String(100), nullable=True)
    net_weight = Column(Numeric(10, 4), nullable=True)
    barcode = Column(BigInteger, nullable=True)
    vat_code = Column(String(50), nullable=True)
    units_per_pack = Column(Integer, nullable=True)
    model_store = Column(String(100), nullable=True)
    batteries = Column(String(100), nullable=True)
    first_rp = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    barcode_ext = Column(BigInteger, nullable=True)
    vat_pct = Column(Numeric(8, 4), nullable=True)
    gm_pct = Column(Numeric(8, 4), nullable=True)
    description1 = Column(String(500), nullable=True)
    description2 = Column(String(500), nullable=True)
    modulo = Column(String(100), nullable=True)
    model_store_portale = Column(String(100), nullable=True)
    modulo_numerico = Column(Numeric(12, 4), nullable=True)
    model_store_portale_num = Column(Numeric(12, 4), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ItemBestSeller(Base):
    """Articoli BestSeller — solo codice articolo."""
    __tablename__ = "item_bestseller"
    __table_args__ = (
        Index("ix_item_bestseller_item_no", "item_no"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Eccezione(Base):
    """Tabella Eccezioni prezzi."""
    __tablename__ = "eccezioni"
    __table_args__ = (
        Index("ix_eccezioni_zebra", "zebra"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    zebra = Column(String(50), nullable=False)
    descrizione = Column(String(500), nullable=True)
    prezzo_1 = Column(Numeric(12, 4), nullable=True)
    prezzo_2 = Column(Numeric(12, 4), nullable=True)
    sconto = Column(String(100), nullable=True)
    testo_prezzo = Column(String(500), nullable=True)
    categoria = Column(String(255), nullable=True)
    eccezione = Column(String(255), nullable=True)
    testo_prezzo2 = Column(String(500), nullable=True)
    col11 = Column(String(255), nullable=True)
    col12 = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScrapInv(Base):
    """Articoli blacklist SCRAP INV (inventario)."""
    __tablename__ = "scrap_inv"
    __table_args__ = (
        Index("ix_scrap_inv_zebra", "zebra"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    zebra = Column(String(50), nullable=False)
    scrap = Column(String(255), nullable=True)
    descrizione = Column(String(500), nullable=True)
    categoria = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScrapWd(Base):
    """Articoli blacklist SCRAP WD (Writedown)."""
    __tablename__ = "scrap_wd"
    __table_args__ = (
        Index("ix_scrap_wd_zebra", "zebra"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    zebra = Column(String(50), nullable=False)
    bloccato = Column(String(255), nullable=True)
    descrizione = Column(String(500), nullable=True)
    categoria = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ItemPicking(Base):
    """Articoli autorizzati al trasferimento tramite PickingList."""
    __tablename__ = "item_picking"
    __table_args__ = (
        Index("ix_item_picking_item_no", "item_no"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
