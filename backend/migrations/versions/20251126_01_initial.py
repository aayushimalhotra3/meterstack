from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20251126_01_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = postgresql.ENUM("owner", "admin", "member", name="user_role", create_type=False)
    billing_interval = postgresql.ENUM("monthly", "yearly", name="billing_interval", create_type=False)
    subscription_status = postgresql.ENUM(
        "active",
        "past_due",
        "canceled",
        "trialing",
        name="subscription_status",
        create_type=False,
    )

    user_role.create(op.get_bind(), checkfirst=True)
    billing_interval.create(op.get_bind(), checkfirst=True)
    subscription_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"]) 

    op.create_table(
        "plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("stripe_product_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
        sa.Column("description", sa.String(length=1024), nullable=True),
        sa.Column("billing_interval", billing_interval, nullable=False),
        sa.Column("base_price_cents", sa.Integer(), nullable=False),
    )

    op.create_table(
        "features",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(length=255), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1024), nullable=True),
    )

    op.create_table(
        "plan_features",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("features.id", ondelete="CASCADE"), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=True),
    )
    op.create_index("ix_plan_features_plan_id", "plan_features", ["plan_id"]) 
    op.create_index("ix_plan_features_feature_id", "plan_features", ["feature_id"]) 
    op.create_unique_constraint("uq_plan_feature", "plan_features", ["plan_id", "feature_id"]) 

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("status", subscription_status, nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"]) 
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"]) 

    op.create_table(
        "usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("feature_key", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_usage_events_tenant_id", "usage_events", ["tenant_id"]) 
    op.create_index("ix_usage_events_feature_key", "usage_events", ["feature_key"]) 
    op.create_index("ix_usage_events_occurred_at", "usage_events", ["occurred_at"]) 


def downgrade() -> None:
    op.drop_index("ix_usage_events_occurred_at", table_name="usage_events")
    op.drop_index("ix_usage_events_feature_key", table_name="usage_events")
    op.drop_index("ix_usage_events_tenant_id", table_name="usage_events")
    op.drop_table("usage_events")

    op.drop_index("ix_subscriptions_plan_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_tenant_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_constraint("uq_plan_feature", "plan_features", type_="unique")
    op.drop_index("ix_plan_features_feature_id", table_name="plan_features")
    op.drop_index("ix_plan_features_plan_id", table_name="plan_features")
    op.drop_table("plan_features")

    op.drop_table("features")
    op.drop_table("plans")

    op.drop_index("ix_users_tenant_id", table_name="users")
    op.drop_table("users")

    op.drop_table("tenants")

    sa.Enum(name="subscription_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="billing_interval").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
