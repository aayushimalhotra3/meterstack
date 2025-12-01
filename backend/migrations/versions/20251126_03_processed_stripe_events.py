from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20251126_03_processed_stripe_events"
down_revision = "20251126_02_tenant_stripe_customer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processed_stripe_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("processed_stripe_events")
