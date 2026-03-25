from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20251126_04_usage_daily"
down_revision = "20251126_03_stripe_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usage_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(length=255), nullable=False),
        sa.Column("total_amount", sa.Integer(), nullable=False),
    )
    op.create_unique_constraint("uq_usage_daily", "usage_daily", ["date", "tenant_id", "feature_key"]) 
    op.create_index("ix_usage_daily_tenant_feature", "usage_daily", ["tenant_id", "feature_key"]) 


def downgrade() -> None:
    op.drop_index("ix_usage_daily_tenant_feature", table_name="usage_daily")
    op.drop_constraint("uq_usage_daily", "usage_daily", type_="unique")
    op.drop_table("usage_daily")
