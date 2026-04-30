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


class ExpoList(Base):
    """Tipo esposizione per articolo: TABLE (etichetta grande) o WALL (etichetta piccola)."""
    __tablename__ = "expo_list"
    __table_args__ = {"schema": "ho"}

    item_no   = Column(String(50), primary_key=True)
    expo_type = Column(String(10), nullable=False)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class EcoList(Base):
    """Articoli ECO — lista presenza da tbl_ECO.xlsx."""
    __tablename__ = "eco_list"
    __table_args__ = {"schema": "ho"}

    item_no   = Column(String(50), primary_key=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class KglList(Base):
    """Peso corretto per articolo da tbl_KGL.xlsm (col D = PESO CORRETTO, col G = KG/L)."""
    __tablename__ = "kgl_list"
    __table_args__ = {"schema": "ho"}

    item_no       = Column(String(50), primary_key=True)
    peso_corretto = Column(Numeric(10, 4), nullable=False)
    kgl_l         = Column(Numeric(10, 4), nullable=True)
    synced_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by     = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class SalesL2W(Base):
    """Venduto ultime 2 settimane per articolo/negozio da SALES X WEEK MASTER.xlsx."""
    __tablename__ = "sales_l2w"
    __table_args__ = (
        Index("ix_sales_l2w_item_no",    "item_no"),
        Index("ix_sales_l2w_store_code", "store_code"),
        {"schema": "ho"},
    )

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no    = Column(String(50),  nullable=False)
    store_code = Column(String(20),  nullable=False)
    qty_sold   = Column(Integer,     nullable=False, default=0)
    week_from  = Column(String(10),  nullable=True)
    week_to    = Column(String(10),  nullable=True)
    synced_at  = Column(DateTime(timezone=True), server_default=func.now())
    synced_by  = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


# ── Converter staging + reference tables ─────────────────────────────────────

class ItemRawNav(Base):
    """Staging: dati grezzi Navision 11 col — corrisponde al foglio Appoggio."""
    __tablename__ = "item_raw_nav"
    __table_args__ = (
        Index("ix_item_raw_nav_item_no", "item_no"),
        {"schema": "ho"},
    )

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no          = Column(String(50), nullable=False)
    description      = Column(String(500), nullable=True)
    description_local= Column(String(500), nullable=True)
    warehouse        = Column(String(50), nullable=True)
    last_cost        = Column(Numeric(12, 4), nullable=True)
    unit_price       = Column(Numeric(12, 4), nullable=True)
    item_cat         = Column(String(100), nullable=True)
    net_weight       = Column(Numeric(10, 4), nullable=True)
    barcode          = Column(BigInteger, nullable=True)
    vat_code         = Column(String(50), nullable=True)
    units_per_pack   = Column(Integer, nullable=True)
    synced_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by        = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemPrice(Base):
    """Prezzi Country RP per articolo — foglio Price del Converter."""
    __tablename__ = "item_price"
    __table_args__ = {"schema": "ho"}

    item_no    = Column(String(50), primary_key=True)
    country_rp = Column(Numeric(12, 4), nullable=True)
    synced_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by  = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemTranslations(Base):
    """Descrizioni italiane per articolo — foglio TRADUZIONI del Converter."""
    __tablename__ = "item_translations"
    __table_args__ = {"schema": "ho"}

    item_no      = Column(String(50), primary_key=True)
    descrizione1 = Column(String(500), nullable=True)
    descrizione2 = Column(String(500), nullable=True)
    synced_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by    = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemBoxSize(Base):
    """Unità per collo per articolo — foglio BOX SIZE del Converter."""
    __tablename__ = "item_box_size"
    __table_args__ = {"schema": "ho"}

    item_no   = Column(String(50), primary_key=True)
    box_size  = Column(Integer, nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemDisplay(Base):
    """Display / VM Module per articolo — foglio Display del Converter."""
    __tablename__ = "item_display"
    __table_args__ = {"schema": "ho"}

    item_no              = Column(String(50), primary_key=True)
    vm_module            = Column(String(100), nullable=True)
    flag_hanging_display = Column(Boolean, nullable=True)
    modulo               = Column(String(100), nullable=True)
    synced_at            = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by            = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemMasterBi(Base):
    """Master Data BI per articolo — foglio 'Master Data Bi' del Converter."""
    __tablename__ = "item_master_bi"
    __table_args__ = {"schema": "ho"}

    item_no      = Column(String(50), primary_key=True)
    category     = Column(String(100), nullable=True)
    subcategory  = Column(String(200), nullable=True)
    barcode_ext  = Column(BigInteger, nullable=True)
    item_type_bi = Column(String(100), nullable=True)
    synced_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by    = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


# ── Converter reference tables ────────────────────────────────────────────────

class ItemKvi(Base):
    """KVI — Key Value Items dal foglio KVI del Converter."""
    __tablename__ = "item_kvi"
    __table_args__ = (
        Index("ix_item_kvi_item_no", "item_no"),
        {"schema": "ho"},
    )

    id        = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no   = Column(String(50), nullable=False)
    item_name = Column(String(500), nullable=True)
    type      = Column(String(50), nullable=True, default="KVI")
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemSbList(Base):
    """SB List — Special Buy dal foglio 'SB LIST' del Converter."""
    __tablename__ = "item_sb_list"
    __table_args__ = (
        Index("ix_item_sb_list_item_no", "item_no"),
        {"schema": "ho"},
    )

    id                  = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no             = Column(String(50), nullable=False)
    promo_name          = Column(String(255), nullable=True)
    data_variazione     = Column(DateTime(timezone=True), nullable=True)
    model_store_finale  = Column(String(100), nullable=True)
    synced_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by           = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemCoreList(Base):
    """Core List — articoli Core/Planogram dal foglio 'CORE LIST' del Converter."""
    __tablename__ = "item_core_list"
    __table_args__ = (
        Index("ix_item_core_list_item_no", "item_no"),
        {"schema": "ho"},
    )

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no        = Column(String(50), nullable=False)
    ax_module_code = Column(String(255), nullable=True)
    type           = Column(String(100), nullable=True)
    type_original  = Column(String(100), nullable=True)
    synced_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by      = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemCampaignsPromo(Base):
    """Campagne Promozionali dal foglio 'CAMPAGNE PROMOZIONALI & PROMO' del Converter."""
    __tablename__ = "item_campaigns_promo"
    __table_args__ = (
        Index("ix_item_campaigns_promo_item_no", "item_no"),
        {"schema": "ho"},
    )

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    item_no            = Column(String(50), nullable=False)
    promo_name         = Column(String(255), nullable=True)
    prezzo_attuale     = Column(Numeric(10, 4), nullable=True)
    prezzo_precedente  = Column(Numeric(10, 4), nullable=True)
    data_variazione    = Column(DateTime(timezone=True), nullable=True)
    fine_variazione    = Column(DateTime(timezone=True), nullable=True)
    fine_promo         = Column(DateTime(timezone=True), nullable=True)
    type_item          = Column(String(100), nullable=True)
    type_after_promo   = Column(String(100), nullable=True)
    promo_in_cassa_pct = Column(Numeric(6, 2), nullable=True)
    prezzo_netto       = Column(Numeric(10, 4), nullable=True)
    status             = Column(String(100), nullable=True)
    synced_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    synced_by          = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)


class ItemIva(Base):
    """Tabella IVA — aliquote per codice IVA Navision."""
    __tablename__ = "item_iva"
    __table_args__ = {"schema": "ho"}

    vat_code   = Column(String(50), primary_key=True)
    vat_pct    = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
