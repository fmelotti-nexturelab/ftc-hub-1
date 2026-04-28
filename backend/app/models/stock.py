from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, Date,
    ForeignKey, Index, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship
from app.database import Base


class StockSession(Base):
    __tablename__ = "stock_sessions"
    __table_args__ = (
        UniqueConstraint("entity", "stock_date", name="uq_stock_session_entity_date"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity = Column(String(10), nullable=False)
    stock_date = Column(Date, nullable=False)
    filename = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False, default="manual")
    total_items = Column(Integer, nullable=False, default=0)
    total_stores = Column(Integer, nullable=False, default=0)
    store_codes_json = Column(Text, nullable=True)  # JSON array of store codes
    uploaded_by = Column(ForeignKey("auth.users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("StockItem", back_populates="session", cascade="all, delete-orphan")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class StockItem(Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        Index("ix_stock_items_session", "session_id"),
        Index("ix_stock_items_item_no", "item_no"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("ho.stock_sessions.id", ondelete="CASCADE"), nullable=False)
    item_no = Column(String(50), nullable=False)
    description = Column(Text, nullable=False, default="")
    description_local = Column(Text, nullable=False, default="")
    adm_stock = Column(Integer, nullable=False, default=0)

    session = relationship("StockSession", back_populates="items")
    store_stocks = relationship("StockStoreData", back_populates="item", cascade="all, delete-orphan")


class StockStoreData(Base):
    __tablename__ = "stock_store_data"
    __table_args__ = (
        Index("ix_stock_store_data_item", "item_id"),
        Index("ix_stock_store_data_store", "store_code"),
        {"schema": "ho"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_id = Column(BigInteger, ForeignKey("ho.stock_items.id", ondelete="CASCADE"), nullable=False)
    store_code = Column(String(10), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)

    item = relationship("StockItem", back_populates="store_stocks")
