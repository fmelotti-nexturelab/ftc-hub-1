import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class TicketCategoryModel(Base):
    __tablename__ = "ticket_categories"
    __table_args__ = {"schema": "tickets"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TicketSubcategoryModel(Base):
    __tablename__ = "ticket_subcategories"
    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_subcategory_category_name"),
        {"schema": "tickets"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("tickets.ticket_categories.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TicketTeamModel(Base):
    __tablename__ = "ticket_teams"
    __table_args__ = {"schema": "tickets"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TicketTeamMemberModel(Base):
    __tablename__ = "ticket_team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
        {"schema": "tickets"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("tickets.ticket_teams.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    is_team_lead = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TicketRoutingRuleModel(Base):
    __tablename__ = "ticket_routing_rules"
    __table_args__ = (
        UniqueConstraint(
            "category_id", "subcategory_id",
            name="uq_routing_rule_cat_subcat",
        ),
        {"schema": "tickets"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("tickets.ticket_categories.id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("tickets.ticket_subcategories.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("tickets.ticket_teams.id"), nullable=True)
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    priority_override = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
