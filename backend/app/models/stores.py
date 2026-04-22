import uuid
import enum
from sqlalchemy import Column, String, Date, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class LocationType(str, enum.Enum):
    STREET = "Street"
    MALL = "Mall"
    OUTLET = "Outlet"
    OTHER = "Other"


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_number = Column(String(20), unique=True, nullable=False, index=True)
    store_name = Column(String(200), nullable=False)
    entity = Column(String(10), nullable=False, index=True)  # IT01, IT02, IT03
    district = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    location_type = Column(String(50), nullable=True)
    opening_date = Column(Date, nullable=True)
    address = Column(String(300), nullable=True)
    postal_code = Column(String(10), nullable=True)
    full_address = Column(String(500), nullable=True)
    nav_code = Column(String(20), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    dm_name = Column(String(200), nullable=True)
    dm_mail = Column(String(200), nullable=True)
    sm_name = Column(String(200), nullable=True)
    sm_mail = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
