import uuid
import enum
from sqlalchemy import (
    CHAR,
    Column,
    String,
    Integer,
    DateTime,
    Boolean,
    Date,
    ForeignKey,
    Enum,
    UniqueConstraint,
    Index,
    TypeDecorator,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from datetime import datetime, timezone

Base = declarative_base()


class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None or isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class BillingInterval(str, enum.Enum):
    monthly = "monthly"
    yearly = "yearly"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    trialing = "trialing"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    stripe_customer_id = Column(String(255), nullable=True)

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="users")

    __table_args__ = (
        Index("ix_users_tenant_id", "tenant_id"),
    )


class Plan(Base):
    __tablename__ = "plans"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    stripe_product_id = Column(String(255), nullable=True)
    stripe_price_id = Column(String(255), nullable=True)
    description = Column(String(1024), nullable=True)
    billing_interval = Column(Enum(BillingInterval, name="billing_interval"), nullable=False)
    base_price_cents = Column(Integer, nullable=False)


class Feature(Base):
    __tablename__ = "features"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    key = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=True)


class PlanFeature(Base):
    __tablename__ = "plan_features"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    plan_id = Column(GUID(), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    feature_id = Column(GUID(), ForeignKey("features.id", ondelete="CASCADE"), nullable=False)
    limit_value = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_id", name="uq_plan_feature"),
        Index("ix_plan_features_plan_id", "plan_id"),
        Index("ix_plan_features_feature_id", "feature_id"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(GUID(), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    stripe_subscription_id = Column(String(255), nullable=True)
    status = Column(Enum(SubscriptionStatus, name="subscription_status"), nullable=False)
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("ix_subscriptions_tenant_id", "tenant_id"),
        Index("ix_subscriptions_plan_id", "plan_id"),
        Index("ix_subscriptions_tenant_status", "tenant_id", "status"),
    )


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feature_key = Column(String(255), nullable=False)
    amount = Column(Integer, nullable=False, default=1)
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_usage_events_tenant_id", "tenant_id"),
        Index("ix_usage_events_feature_key", "feature_key"),
        Index("ix_usage_events_occurred_at", "occurred_at"),
        Index("ix_usage_events_tenant_feature_occurred", "tenant_id", "feature_key", "occurred_at"),
    )


class ProcessedStripeEvent(Base):
    __tablename__ = "processed_stripe_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class UsageDaily(Base):
    __tablename__ = "usage_daily"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    feature_key = Column(String(255), nullable=False)
    total_amount = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("date", "tenant_id", "feature_key", name="uq_usage_daily"),
        Index("ix_usage_daily_tenant_feature", "tenant_id", "feature_key"),
        Index("ix_usage_daily_tenant_feature_date", "tenant_id", "feature_key", "date"),
    )


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False)
    key_prefix = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_api_keys_tenant_id", "tenant_id"),
        Index("ix_api_keys_prefix", "key_prefix"),
    )
