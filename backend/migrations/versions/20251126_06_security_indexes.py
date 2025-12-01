from alembic import op
import sqlalchemy as sa

revision = "20251126_06_security_indexes"
down_revision = "20251126_05_api_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_usage_events_tenant_feature_occurred", "usage_events", ["tenant_id", "feature_key", "occurred_at"]) 
    op.create_index("ix_usage_daily_tenant_feature_date", "usage_daily", ["tenant_id", "feature_key", "date"]) 
    op.create_index("ix_subscriptions_tenant_status", "subscriptions", ["tenant_id", "status"]) 


def downgrade() -> None:
    op.drop_index("ix_subscriptions_tenant_status", table_name="subscriptions")
    op.drop_index("ix_usage_daily_tenant_feature_date", table_name="usage_daily")
    op.drop_index("ix_usage_events_tenant_feature_occurred", table_name="usage_events")
